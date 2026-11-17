import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rm,readdir,stat,statfs} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {db,databasePath,tableExists} from './db';
import {currentApplication} from './application-context';
import {currentAccess,currentUser,assertTablePermission,canExport} from './permissions';
import {AuthError} from './auth';
import {currentDevelopment} from './development-context';
import {recordAppUsage} from './app-usage';
import {rawQuery,validateRawSelect,type RawColumn} from './raw-query';
type Job={id:string;user:number;app:string;workspace:string;table:string;kind:'export'|'sql';format:string;created:number;folder:string;reserved:number;state:'queued'|'running'|'succeeded'|'failed';error?:string};
const root=globalThis as typeof globalThis&{__rawDataJobs?:Map<string,Job>;__rawDataCleanup?:ReturnType<typeof setInterval>};
const jobs=root.__rawDataJobs??=new Map<string,Job>();
const TTL=30*60000,MAX_BYTES=2*1024*1024*1024;
export function assertRawManager(table:string,exporting=false){if(!currentAccess().builder)throw new AuthError('เฉพาะผู้พัฒนาแอปที่มีสิทธิ์ตารางนี้',403);if(!tableExists(table))throw new AuthError('ไม่พบตารางที่เชื่อมกับแอปนี้',404);assertTablePermission(table,'read');if(exporting&&!canExport(table))throw new AuthError('ไม่มีสิทธิ์ส่งออกตารางนี้',403);}
export function rawColumns(table:string){return db.prepare('PRAGMA table_info("t_'+table+'")').all() as RawColumn[];}
async function cleanup(){const dir=join(dirname(databasePath),'.raw-data-jobs');await mkdir(dir,{recursive:true,mode:0o700});for(const entry of await readdir(dir)){if(!/^[0-9a-f-]{36}$/.test(entry))continue;const folder=join(dir,entry);try{if(Date.now()-(await stat(folder)).mtimeMs>TTL){await rm(folder,{recursive:true,force:true});jobs.delete(entry);}}catch{}}for(const [id,j]of jobs)if(Date.now()-j.created>TTL){jobs.delete(id);await rm(j.folder,{recursive:true,force:true});}return dir;}
export function startRawDataCleanup(){if(root.__rawDataCleanup)return;root.__rawDataCleanup=setInterval(()=>{void cleanup().catch(()=>{});},5*60000);root.__rawDataCleanup.unref();}
export async function startRawJob(table:string,body:Record<string,any>){
 const kind=body.kind==='sql'?'sql':body.kind==='export'?'export':null;if(!kind)throw Error('ประเภทงานไม่ถูกต้อง');assertRawManager(table,kind==='export');
 const user=currentUser()!,app=currentApplication()?.id||'default';startRawDataCleanup();await cleanup();
 const active=[...jobs.values()].filter(j=>['queued','running'].includes(j.state));if(active.length>=4||active.filter(j=>j.user===user.id).length>=2)throw new AuthError('มีงานกำลังทำอยู่ กรุณารอสักครู่',429);
 const format=kind==='sql'?'json':body.format;if(!['sql','csv','json'].includes(format))throw Error('รูปแบบส่งออกไม่ถูกต้อง');
 const columns=rawColumns(table),plan=rawQuery(body.query||{},columns);
 const selected=body.columns===undefined?columns.map(c=>c.name):body.columns;if(!Array.isArray(selected)||!selected.length||selected.length>columns.length||new Set(selected).size!==selected.length||selected.some(c=>typeof c!=='string'||!columns.some(v=>v.name===c)))throw Error('คอลัมน์ส่งออกไม่ถูกต้อง');
 const sql=kind==='sql'?validateRawSelect(body.sql):undefined;
 const schema=body.schema||'both';if(!['both','data','schema'].includes(schema))throw Error('รูปแบบโครงสร้างส่งออกไม่ถูกต้อง');if(format==='sql'&&schema!=='data'&&selected.length!==columns.length)throw Error('การส่งออกโครงสร้างต้องเลือกทุกคอลัมน์');
 const pages=Number(db.pragma('page_count',{simple:true})),pageSize=Number(db.pragma('page_size',{simple:true}));if(pages*pageSize>MAX_BYTES)throw new AuthError('ฐานข้อมูลเกิน 2 GB กรุณาใช้เครื่องมือสำรองภายนอก',413);
 const reserved=pages*pageSize*2+1024*1024*1024,space=await statfs(dirname(databasePath));if(space.bavail*space.bsize<reserved+512*1024*1024+[...jobs.values()].filter(j=>['queued','running'].includes(j.state)).reduce((sum,j)=>sum+(j.reserved||0),0))throw new AuthError('พื้นที่ว่างไม่พอสำหรับสำเนาและไฟล์ส่งออก กรุณาล้างพื้นที่ก่อน',413);
 // Recheck after asynchronous disk inspection before reserving a process slot.
 const latest=[...jobs.values()];if(latest.filter(j=>['queued','running'].includes(j.state)).length>=4||latest.filter(j=>j.user===user.id&&['queued','running'].includes(j.state)).length>=2||latest.filter(j=>j.user===user.id).length>=20)throw new AuthError('เกินจำนวนงาน กรุณารอให้งานเสร็จหรือไฟล์เก่าหมดอายุ',429);
 const id=randomUUID(),folder=join(dirname(databasePath),'.raw-data-jobs',id);
 const job:Job={id,user:user.id,app,workspace:currentDevelopment()?.id||'',table,kind,format,created:Date.now(),folder,reserved,state:'queued'};jobs.set(id,job);
 try{await mkdir(folder,{mode:0o700});}catch(e){jobs.delete(id);throw e;}
 // SQLite backup creates a consistent snapshot, including isolated development DBs.
 await(async()=>{try{await db.backup(join(folder,'snapshot.db'));await writeFile(join(folder,'request.json'),JSON.stringify({table,kind,format,plan,columns:selected,schema,sql,created:Date.now()}),{mode:0o600});job.state='running';const child=spawn(process.execPath,[resolve('scripts/raw-data-worker.cjs'),folder],{stdio:'ignore',windowsHide:true});const timer=setTimeout(()=>{child.kill();job.state='failed';job.error='งานใช้เวลาเกินกำหนด กรุณาแบ่งเงื่อนไขให้แคบลง';},15*60000);timer.unref();child.on('error',()=>{clearTimeout(timer);job.state='failed';job.error='เริ่มงานไม่สำเร็จ';void rm(join(folder,'snapshot.db'),{force:true});});child.on('exit',code=>{clearTimeout(timer);void rm(join(folder,'snapshot.db'),{force:true});void rm(join(folder,'query.db'),{force:true});if(job.state==='failed')return;job.state=code===0?'succeeded':'failed';if(code!==0)job.error='ประมวลผลไม่สำเร็จ กรุณาตรวจคำสั่งหรือขนาดข้อมูล';void rm(join(folder,'snapshot.db'),{force:true});});}catch{job.state='failed';job.error='สร้างสำเนาข้อมูลไม่สำเร็จ';await rm(join(folder,'snapshot.db'),{force:true});}})();
 // Only the operation/table is logged, never SQL text or cell values.
 recordAppUsage(db,user,app,kind==='export'?'export':'sql_read','raw:'+table,job.state==='failed'?500:202);
 return {id,state:job.state,expiresAt:job.created+TTL,...(job.error?{error:job.error}:{})};
}
export async function getRawJob(table:string,id:string,download=false){const job=jobs.get(id);if(!job||job.user!==currentUser()?.id||job.app!==(currentApplication()?.id||'default')||job.workspace!==(currentDevelopment()?.id||'')||job.table!==table||Date.now()-job.created>TTL)throw new AuthError('ไม่พบงานหรือไฟล์หมดอายุแล้ว',404);assertRawManager(table,job.kind==='export');
 let info:Record<string,any>={};try{info=JSON.parse(await readFile(join(job.folder,'result.json'),'utf8'));}catch{}
 if(download){assertRawManager(table,true);if(job.state!=='succeeded')throw new AuthError('ไฟล์ยังไม่พร้อมดาวน์โหลด',409);return {job,path:join(job.folder,'output.'+job.format)};}
 return {id:job.id,kind:job.kind,state:job.state,format:job.format,expiresAt:job.created+TTL,...info,...(job.error&&!info.error?{error:job.error}:{})};
}
