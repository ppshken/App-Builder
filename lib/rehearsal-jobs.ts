import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {dirname,join,resolve,relative} from 'node:path';
import {mkdirSync,chmodSync,rmSync} from 'node:fs';
import {validApplicationId} from './application-context';
import type {RehearsalResult} from './release-rehearsal';
export type RehearsalJob={id:string;app_id:string;workspace_id:string;owner:number;plan_hash:string;status:'queued'|'running'|'passed'|'failed'|'blocked'|'cancelled'|'interrupted';created_at:number;updated_at:number;lease_until:number;token:string|null;cancel_requested:number;stage:string;processed:number;total:number;result_json:string|null;cleanup:number;worker_pid?:number;mode?:"sample"|"full"};
export const rehearsalQueuePath=(databasePath:string)=>join(dirname(databasePath),'.app-releases','rehearsal-jobs.db');
export const REHEARSAL_LEASE_MS=90000;
export function openRehearsalQueue(path:string){mkdirSync(dirname(path),{recursive:true,mode:0o700});const q=new Database(path);chmodSync(path,0o600);q.pragma('busy_timeout=5000');q.exec(`CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,app_id TEXT NOT NULL,workspace_id TEXT NOT NULL,owner INTEGER NOT NULL,plan_hash TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,token TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0,stage TEXT NOT NULL DEFAULT 'QUEUED',processed INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,result_json TEXT,cleanup INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS one_workspace_job ON jobs(app_id,workspace_id,owner) WHERE status IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS one_running_job ON jobs((1)) WHERE status='running';`);if(!(q.pragma('table_info(jobs)') as {name:string}[]).some((c:any)=>c.name==='worker_pid'))q.exec('ALTER TABLE jobs ADD COLUMN worker_pid INTEGER');if(!(q.pragma('table_info(jobs)') as {name:string}[]).some(c=>c.name==='mode'))q.exec("ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'full'");return q;}
const uuid=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export function enqueueRehearsal(q:Database.Database,input:{appId:string;workspaceId:string;owner:number;planHash:string;mode?:"sample"|"full"}){
 if(input.mode!==undefined&&!['sample','full'].includes(input.mode))throw Error('รูปแบบการซ้อมไม่ถูกต้อง');
 if(!validApplicationId(input.appId)||!uuid(input.workspaceId)||!Number.isSafeInteger(input.owner)||input.owner<1||!/^[a-f0-9]{64}$/.test(input.planHash))throw Error('ข้อมูลคิวซ้อมไม่ถูกต้อง');
 return q.transaction(()=>{const existing=q.prepare("SELECT * FROM jobs WHERE app_id=? AND workspace_id=? AND owner=? AND status IN ('queued','running')").get(input.appId,input.workspaceId,input.owner) as RehearsalJob|undefined;if(existing){if(existing.plan_hash!==input.planHash||(existing.mode||"full")!==(input.mode||"full"))throw Error('มีงานเดิมอยู่ กรุณายกเลิกหรือรอให้จบก่อน');return existing;}
 if((q.prepare("SELECT count(*) n FROM jobs WHERE status IN ('queued','running')").get() as {n:number}).n>=20)throw Error('คิวซ้อมเต็ม กรุณาลองใหม่ภายหลัง');
 const id=randomUUID(),now=Date.now();q.prepare("INSERT INTO jobs(id,app_id,workspace_id,owner,plan_hash,mode,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'queued',?,?)").run(id,input.appId,input.workspaceId,input.owner,input.planHash,input.mode||"full",now,now);return q.prepare('SELECT * FROM jobs WHERE id=?').get(id) as RehearsalJob;
 }).immediate();
}
export function claimRehearsal(q:Database.Database,now=Date.now()){
 return q.transaction(()=>{q.prepare("UPDATE jobs SET status='interrupted',stage='INTERRUPTED',cleanup=1,updated_at=? WHERE status='running' AND lease_until<?").run(now,now);q.prepare("UPDATE jobs SET status='interrupted',stage='EXPIRED',updated_at=? WHERE status='queued' AND created_at<?").run(now,now-3600000);
 if(q.prepare("SELECT 1 FROM jobs WHERE status='running'").get())return;
 const row=q.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1").get() as RehearsalJob|undefined;if(!row)return;
 const token=randomUUID();q.prepare("UPDATE jobs SET status='running',stage='STARTING',token=?,lease_until=?,updated_at=?,cleanup=1 WHERE id=? AND status='queued'").run(token,now+REHEARSAL_LEASE_MS,now,row.id);return q.prepare('SELECT * FROM jobs WHERE id=?').get(row.id) as RehearsalJob;
 }).immediate();
}
export function jobCheckpoint(q:Database.Database,job:RehearsalJob,stage:string,processed=0,total=0){const row=q.prepare('SELECT status,token,cancel_requested FROM jobs WHERE id=?').get(job.id) as RehearsalJob|undefined;if(row?.status!=='running'||row.token!==job.token||row.cancel_requested)throw Error('หยุดงานซ้อม');q.prepare("UPDATE jobs SET stage=?,processed=?,total=?,updated_at=? WHERE id=? AND token=? AND status='running'").run(stage,processed,total,Date.now(),job.id,job.token);}
export function finishRehearsal(q:Database.Database,job:RehearsalJob,result?:RehearsalResult){return q.prepare("UPDATE jobs SET status=CASE WHEN cancel_requested=1 THEN 'cancelled' ELSE ? END,stage='FINISHED',result_json=CASE WHEN cancel_requested=1 THEN NULL ELSE ? END,updated_at=? WHERE id=? AND token=? AND status='running'").run(result?.status||'interrupted',result?JSON.stringify(result):null,Date.now(),job.id,job.token).changes;}
export function cancelRehearsal(q:Database.Database,id:string,appId:string,workspaceId:string,owner:number){q.prepare("UPDATE jobs SET cancel_requested=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,updated_at=? WHERE id=? AND app_id=? AND workspace_id=? AND owner=? AND status IN ('queued','running')").run(Date.now(),id,appId,workspaceId,owner);}
export function latestRehearsalJob(q:Database.Database,appId:string,workspaceId:string,owner:number){return q.prepare('SELECT * FROM jobs WHERE app_id=? AND workspace_id=? AND owner=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(appId,workspaceId,owner) as RehearsalJob|undefined;}
export function cleanupRehearsalJob(databasePath:string,job:RehearsalJob){
 if(!validApplicationId(job.app_id)||!uuid(job.workspace_id)||!uuid(job.id))throw Error('เส้นทางงานซ้อมไม่ถูกต้อง');
 const root=resolve(dirname(databasePath),'.app-releases',...(job.app_id==='default'?[]:[job.app_id]),job.workspace_id),target=resolve(root,'rehearsal-'+job.id);
 if(relative(root,target)!=='rehearsal-'+job.id)throw Error('เส้นทางงานซ้อมไม่ถูกต้อง');rmSync(target,{recursive:true,force:true});
}
export function sweepRehearsals(q:Database.Database,databasePath:string){for(const job of q.prepare("SELECT * FROM jobs WHERE cleanup=1 AND status NOT IN ('queued','running') LIMIT 20").all() as RehearsalJob[])try{cleanupRehearsalJob(databasePath,job);q.prepare('UPDATE jobs SET cleanup=0 WHERE id=?').run(job.id);}catch{/* Keep cleanup pending; never broaden deletion scope. */}}
