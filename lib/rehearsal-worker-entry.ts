import {platformDatabase,databasePath,withDatabase} from './db';
import Database from 'better-sqlite3';
import {applicationScopeFor} from './applications';
import {withApplication} from './application-context';
import {accessFor,runAuthorized} from './permissions';
import {withAuditActor} from './audit-context';
import {rehearseDraft} from './releases';
import {openRehearsalQueue,rehearsalQueuePath,claimRehearsal,jobCheckpoint,finishRehearsal,sweepRehearsals} from './rehearsal-jobs';
import {REHEARSAL_SAMPLE_LIMIT} from './release-rehearsal';
import {statfsSync} from 'node:fs';
import {dirname} from 'node:path';
import type {AuthUser} from './auth';

// The process receives no user data, SQL, credentials or paths from HTTP input.
async function main(){
 const q=openRehearsalQueue(rehearsalQueuePath(databasePath)),job=claimRehearsal(q);if(!job){q.close();return;}
 q.prepare('UPDATE jobs SET worker_pid=? WHERE id=? AND token=?').run(process.pid,job.id,job.token);
 process.send?.({id:job.id,token:job.token});
 const cancelled=()=>!!(q.prepare('SELECT cancel_requested FROM jobs WHERE id=?').get(job.id) as {cancel_requested:number}|undefined)?.cancel_requested;
 try{
  const database=platformDatabase(),user=database.prepare("SELECT id,name,COALESCE(email,'') email,role,active FROM _users WHERE id=?").get(job.owner) as AuthUser&{active:number}|undefined;
  if(!user?.active)throw Error('สิทธิ์ผู้ใช้เปลี่ยน');
  const app=applicationScopeFor(user,job.app_id),size=Number(database.pragma('page_count',{simple:true}))*Number(database.pragma('page_size',{simple:true})),space=statfsSync(dirname(databasePath));
  if(size>2*1024**3||space.bavail*space.bsize<size*2+64*1024**2)throw Error('พื้นที่ซ้อมไม่เพียงพอ');
  const result=await withApplication(app,()=>{const access=accessFor(user);if(!access.builder)throw Error('สิทธิ์ผู้พัฒนาเปลี่ยน');return runAuthorized(user,access,()=>withAuditActor(user,'release-rehearsal',()=>rehearseDraft(job.workspace_id,job.owner,job.plan_hash,{jobId:job.id,mode:job.mode||"full",limit:job.mode==="sample"?REHEARSAL_SAMPLE_LIMIT:1000000,deadline:Date.now()+(job.mode==="sample"?2:15)*60000,checkpoint:(stage,processed,total)=>jobCheckpoint(q,job,stage,processed,total),cancelled})));});
  jobCheckpoint(q,job,'FINISHING');finishRehearsal(q,job,result);
 }catch{finishRehearsal(q,job);}finally{sweepRehearsals(q,databasePath);q.close();}
}
// If the supervising web process exits, do not leave a detached child running.
process.on('disconnect',()=>process.exit(1));
const source=new Database(databasePath,{readonly:true,fileMustExist:true});
void withDatabase(source,main).then(()=>{source.close();process.exit(0);},()=>{source.close();process.exit(1);});
