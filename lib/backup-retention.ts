import Database from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,lstatSync,chmodSync,unlinkSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {backupFolder,backupFile,listBackups,type BackupInfo} from './backups';
import {AuthError} from './auth';
export type BackupRetentionPolicy={enabled:boolean;days:number;keepLatest:number;maxAutomaticFiles:number;maxAutomaticMB:number};
export const DEFAULT_BACKUP_RETENTION:BackupRetentionPolicy={enabled:false,days:7,keepLatest:3,maxAutomaticFiles:0,maxAutomaticMB:0};
type Item=BackupInfo&{signature:string;kind:'manual'|'schema'|'restore'|'update';modifiedAt:number};
type Candidate=Item&{deletionReason:string};
export type BackupCleanupResult={status:'completed'|'partial'|'disabled'|'skipped';deleted:number;freedBytes:number;failed:string[];skipped:number;at:number};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function policy(value:unknown):BackupRetentionPolicy{
 const p=value as BackupRetentionPolicy;if(!p||typeof p.enabled!=='boolean')throw new AuthError('กรุณาระบุเปิดหรือปิดการล้างอัตโนมัติ');
 for(const [key,min,max]of [['days',1,3650],['keepLatest',1,100],['maxAutomaticFiles',0,100000],['maxAutomaticMB',0,1048576]] as const)if(!Number.isSafeInteger(p[key])||p[key]<min||p[key]>max)throw new AuthError('ค่าการเก็บไฟล์สำรองไม่ถูกต้อง: '+key);
 return {enabled:p.enabled,days:p.days,keepLatest:p.keepLatest,maxAutomaticFiles:p.maxAutomaticFiles,maxAutomaticMB:p.maxAutomaticMB};
}
function storePath(source:string){return join(dirname(resolve(source)),'.backup-management','retention.db');}
function store(source:string,create=false){
 const file=storePath(source),folder=dirname(file);if(!create&&!existsSync(file))return null;
 if(create)mkdirSync(folder,{recursive:true,mode:0o700});
 if(lstatSync(folder).isSymbolicLink()||existsSync(file)&&lstatSync(file).isSymbolicLink())throw new AuthError('พื้นที่ตั้งค่าสำรองต้องไม่เป็นทางลัด');
 const q=new Database(file,{readonly:!create,fileMustExist:!create});q.pragma('busy_timeout=5000');
 if(create){chmodSync(file,0o600);q.exec("CREATE TABLE IF NOT EXISTS policy(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS previews(token TEXT PRIMARY KEY,owner INTEGER NOT NULL,expires INTEGER NOT NULL,inventory_hash TEXT NOT NULL,policy_hash TEXT NOT NULL,candidates_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',result_json TEXT);CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,at INTEGER NOT NULL,actor INTEGER NOT NULL,kind TEXT NOT NULL,result_json TEXT NOT NULL)");}
 return q;
}
function readPolicy(q:Database.Database|null){const row=q?.prepare('SELECT json FROM policy WHERE id=1').get() as {json:string}|undefined;return row?policy(JSON.parse(row.json)):{...DEFAULT_BACKUP_RETENTION};}
export function saveBackupRetentionPolicy(source:string,input:unknown,actor:number){const next=policy(input),q=store(source,true)!;try{q.transaction(()=>{q.prepare('INSERT INTO policy(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(JSON.stringify(next));q.prepare('INSERT INTO history VALUES(?,?,?,?,?)').run(randomUUID(),Date.now(),actor,'policy',JSON.stringify(next));})();return next;}finally{q.close();}}
function signature(file:string){const s=lstatSync(file,{bigint:true});if(!s.isFile()||s.isSymbolicLink())throw new AuthError('ไฟล์สำรองเปลี่ยน กรุณาตรวจรายการใหม่',409);return JSON.stringify([s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String));}
function scan(source:string):Item[]{return listBackups(source).map(f=>{const file=backupFile(source,f.name);return {...f,signature:signature(file),modifiedAt:Date.parse(f.created),kind:f.name.startsWith('data.backup-manual-')?'manual' as const:f.name.startsWith('data.backup-schema-')?'schema' as const:f.name.startsWith('data.backup-restore-')?'restore' as const:f.name.startsWith('data.before-')?'update' as const:'manual' as const};}).sort((a,b)=>b.modifiedAt-a.modifiedAt||a.name.localeCompare(b.name));}
function preview(source:string,p:BackupRetentionPolicy,now:number){
 const files=scan(source),automatic=files.filter(f=>f.kind!=='manual'),protectedNames=new Set(automatic.slice(0,p.keepLatest).map(f=>f.name));
 for(const kind of ['schema','restore','update']){const latest=automatic.find(f=>f.kind===kind);if(latest)protectedNames.add(latest.name);}
 // Fresh files include snapshots still being produced by another process.
 for(const file of automatic)if(file.modifiedAt>=now-10*60000)protectedNames.add(file.name);
 const candidates:Candidate[]=[],selected=new Set<string>();let remaining=automatic.length,bytes=automatic.reduce((n,f)=>n+f.size,0);
 const choose=(f:Item,reason:string)=>{selected.add(f.name);candidates.push({...f,deletionReason:reason});remaining--;bytes-=f.size;};
 for(const file of [...automatic].reverse())if(!protectedNames.has(file.name)&&file.modifiedAt<now-p.days*86400000)choose(file,'เก่ากว่า '+p.days+' วัน');
 const exceeded=()=>!!(p.maxAutomaticFiles&&remaining>p.maxAutomaticFiles||p.maxAutomaticMB&&bytes>p.maxAutomaticMB*1024**2);
 for(const file of [...automatic].reverse())if(exceeded()&&!selected.has(file.name)&&!protectedNames.has(file.name))choose(file,'เกินจำนวนหรือพื้นที่ที่กำหนด');
 return {policy:p,totalFiles:files.length,totalBytes:files.reduce((n,f)=>n+f.size,0),automaticFiles:automatic.length,automaticBytes:automatic.reduce((n,f)=>n+f.size,0),manualFiles:files.length-automatic.length,protectedFiles:protectedNames.size,candidates,reclaimableBytes:candidates.reduce((n,f)=>n+f.size,0),limitExceeded:exceeded(),inventoryHash:hash(files.map(f=>[f.name,f.signature])),policyHash:hash(p)};
}
export function previewBackupRetention(source:string,now=Date.now()){const q=store(source);try{return preview(source,readPolicy(q),now);}finally{q?.close();}}
export function backupRetentionOverview(source:string){const q=store(source);try{const review=preview(source,readPolicy(q),Date.now()),last=q?.prepare("SELECT result_json FROM history WHERE kind IN ('manual','automatic') ORDER BY at DESC LIMIT 1").get() as {result_json:string}|undefined;return {...review,candidates:undefined,candidateCount:review.candidates.length,inventoryHash:undefined,policyHash:undefined,lastRun:last?JSON.parse(last.result_json):null};}finally{q?.close();}}
export function createBackupCleanupPreview(source:string,owner:number,now=Date.now()){
 const q=store(source,true)!;try{return q.transaction(()=>{const r=preview(source,readPolicy(q),now),token=randomUUID();q.prepare('DELETE FROM previews WHERE expires<?').run(now-7*86400000);q.prepare('INSERT INTO previews(token,owner,expires,inventory_hash,policy_hash,candidates_json) VALUES(?,?,?,?,?,?)').run(token,owner,now+10*60000,r.inventoryHash,r.policyHash,JSON.stringify(r.candidates));return {...r,candidates:r.candidates.map(({signature,modifiedAt,kind,...f})=>f),inventoryHash:undefined,policyHash:undefined,token,expires:now+10*60000};}).immediate();}finally{q.close();}
}
function publicationActive(source:string,now:number){const file=join(dirname(resolve(source)),'.app-releases','publications.db');if(!existsSync(file))return false;const q=new Database(file,{readonly:true,fileMustExist:true});try{return !!q.prepare("SELECT 1 FROM attempts WHERE status='preparing' AND lease_until>=?").get(now);}finally{q.close();}}
function remove(source:string,candidates:Candidate[],now:number):BackupCleanupResult{
 if(publicationActive(source,now))throw new AuthError('มีงานเผยแพร่โครงสร้างกำลังทำงาน กรุณารอแล้วตรวจรายการใหม่',409);
 const folder=backupFolder(source),result:BackupCleanupResult={status:'completed',deleted:0,freedBytes:0,failed:[],skipped:0,at:now};
 for(const file of candidates){try{const target=backupFile(source,file.name);if(relative(folder,target)!==file.name||signature(target)!==file.signature){result.skipped++;continue;}unlinkSync(target);result.deleted++;result.freedBytes+=file.size;}catch{result.failed.push(file.name);}}
 if(result.failed.length||result.skipped)result.status='partial';return result;
}
export function executeBackupCleanup(source:string,owner:number,token:unknown,confirmation:unknown,now=Date.now()){
 if(confirmation!=='ล้างไฟล์สำรอง')throw new AuthError('กรุณาพิมพ์ ล้างไฟล์สำรอง เพื่อยืนยัน');
 if(typeof token!=='string'||!/^[a-f0-9-]{36}$/.test(token))throw new AuthError('รายการยืนยันไม่ถูกต้อง',409);
 const q=store(source,true)!;try{return q.transaction(()=>{const saved=q.prepare('SELECT * FROM previews WHERE token=?').get(token) as {owner:number;expires:number;inventory_hash:string;policy_hash:string;candidates_json:string;status:string;result_json:string}|undefined;
  if(!saved||saved.owner!==owner)throw new AuthError('ไม่มีสิทธิ์ใช้รายการยืนยันนี้',403);if(saved.status==='done')return JSON.parse(saved.result_json) as BackupCleanupResult;if(saved.expires<now)throw new AuthError('รายการยืนยันหมดอายุ กรุณาตรวจใหม่',409);
  const current=preview(source,readPolicy(q),now);if(current.inventoryHash!==saved.inventory_hash||current.policyHash!==saved.policy_hash)throw new AuthError('ไฟล์หรือนโยบายเปลี่ยน กรุณาตรวจรายการที่จะล้างใหม่',409);
  const result=remove(source,JSON.parse(saved.candidates_json),now);q.prepare("UPDATE previews SET status='done',result_json=? WHERE token=?").run(JSON.stringify(result),token);q.prepare('INSERT INTO history VALUES(?,?,?,?,?)').run(randomUUID(),now,owner,'manual',JSON.stringify(result));return result;
 }).immediate();}finally{q.close();}
}
export function runAutomaticBackupRetention(source:string,now=Date.now()):BackupCleanupResult{
 const q=store(source);if(!q)return {status:'disabled',deleted:0,freedBytes:0,failed:[],skipped:0,at:now};let enabled=false;try{enabled=readPolicy(q).enabled;}finally{q.close();}if(!enabled)return {status:'disabled',deleted:0,freedBytes:0,failed:[],skipped:0,at:now};
 const write=store(source,true)!;try{return write.transaction(()=>{const p=readPolicy(write);if(!p.enabled)return {status:'disabled' as const,deleted:0,freedBytes:0,failed:[],skipped:0,at:now};const r=preview(source,p,now);if(!r.candidates.length)return {status:'completed' as const,deleted:0,freedBytes:0,failed:[],skipped:0,at:now};let result:BackupCleanupResult;try{result=remove(source,r.candidates,now);}catch(e){if(e instanceof AuthError)result={status:'skipped',deleted:0,freedBytes:0,failed:[],skipped:r.candidates.length,at:now};else throw e;}write.prepare('INSERT INTO history VALUES(?,?,?,?,?)').run(randomUUID(),now,0,'automatic',JSON.stringify(result));return result;}).immediate();}finally{write.close();}
}
