import {NextResponse} from 'next/server';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {withAuth} from '@/lib/auth-api';
import {currentUser} from '@/lib/permissions';
import {platformDatabase,databasePath,databaseGeneration} from '@/lib/db';
import {applicationBackupPlan,exportApplicationBackup,restoreApplicationBackup} from '@/lib/application-backups';
import {backupFolder,inspectBackup,cleanStage,MAX_BACKUP_BYTES,createBackup} from '@/lib/backups';
import {restoreAccountRevision} from '@/lib/restore-applications';
import {readBody,bad,errorMessage,errorStatus} from '@/lib/api';
import {recordAppUsage} from '@/lib/app-usage';
type Stage={folder:string;owner:number;expires:number;generation:number;revision:string};
const state=globalThis as typeof globalThis & {__appBackupStages?:Map<string,Stage>};
const stages=state.__appBackupStages??=new Map<string,Stage>();
function folder(){const path=join(backupFolder(databasePath),'.restore-stage-'+randomUUID());mkdirSync(path);return path;}
function expire(){for(const [token,s] of stages)if(s.expires<Date.now()){stages.delete(token);cleanStage(s.folder);}}
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request)=>{let path='';try{const params=new URL(req.url).searchParams,id=params.get('app')||'',actor=currentUser()!;const plan=applicationBackupPlan(actor,id);if(params.get('download')!=='1')return NextResponse.json(plan);path=folder();exportApplicationBackup(actor,id,join(path,'upload.db'));inspectBackup(join(path,'upload.db'),join(path,'ready.db'),platformDatabase(),true);const data=readFileSync(join(path,'upload.db'));recordAppUsage(platformDatabase(),actor,id,'backup','application');return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'application/vnd.sqlite3','Content-Disposition':'attachment; filename="app-'+id+'-'+Date.now()+'.app.db"'}});}catch(e){return bad(errorMessage(e),errorStatus(e));}finally{if(path)cleanStage(path);}});
export const POST=withAuth(async(req:Request)=>{let path='';try{expire();const actor=currentUser()!,db=platformDatabase();if(req.headers.get('content-type')?.includes('application/json')){const b=await readBody(req),s=stages.get(String(b.token));if(!s||s.owner!==actor.id||s.expires<Date.now())throw Error('รายการตรวจไฟล์หมดอายุ กรุณาตรวจใหม่');if(b.op==='cancel'){stages.delete(String(b.token));cleanStage(s.folder);return NextResponse.json({ok:true});}if(b.op!=='restore'||b.confirmation!=='กู้คืน'||typeof b.label!=='string'||!b.label.trim())throw Error('กรอกชื่อแอปใหม่และพิมพ์ กู้คืน เพื่อยืนยัน');if(s.generation!==databaseGeneration()||s.revision!==restoreAccountRevision(db))throw Error('ข้อมูลระบบหรือบัญชีเปลี่ยน กรุณาตรวจไฟล์ใหม่');createBackup(db,databasePath,'restore');const source=new Database(join(s.folder,'ready.db'),{readonly:true});try{const result=restoreApplicationBackup(actor,source,b.label);stages.delete(String(b.token));return NextResponse.json(result,{status:201});}finally{source.close();if(!stages.has(String(b.token)))cleanStage(s.folder);}}
 if(stages.size>=4)throw Error('มีไฟล์รอตรวจหลายรายการ กรุณารอหรือยกเลิกก่อน');const reader=req.body?.getReader();if(!reader)throw Error('กรุณาเลือกไฟล์');const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BACKUP_BYTES+65536){await reader.cancel();throw Error('ไฟล์ต้องไม่เกิน 512 MB');}chunks.push(part.value);}const form=await new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array(Buffer.concat(chunks))}).formData(),file=form.get('file');if(!file||typeof file==='string')throw Error('กรุณาเลือกไฟล์สำรองรายแอป');path=folder();writeFileSync(join(path,'upload.db'),new Uint8Array(await file.arrayBuffer()));const summary=inspectBackup(join(path,'upload.db'),join(path,'ready.db'),db,true),token=randomUUID();stages.set(token,{folder:path,owner:actor.id,expires:Date.now()+15*60000,generation:databaseGeneration(),revision:restoreAccountRevision(db)});path='';return NextResponse.json({token,summary});
 }catch(e){return bad(errorMessage(e),errorStatus(e));}finally{if(path)cleanStage(path);}});
