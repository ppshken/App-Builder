import {currentDevelopment} from './development-context';
import {emitSourceWorkflowEvent} from './external-workflow-events';
import {randomUUID} from 'node:crypto';
import {db,databaseGeneration} from './db';
import {currentApplication,withApplication} from './application-context';
import {applicationScopeFor} from './applications';
import {accessFor,runAuthorized,currentAccess} from './permissions';
import {withAuditActor} from './audit-context';
import {externalSource,sourceConfig,applyImportedRows,enqueueExternalSync,type ExternalSource} from './external-sources';
import {acquireExternalLease} from './external-connector';
import {restDataConnector} from './data-source-registry';
import {mapExternalRows,resolveJsonPath,advanceExternalCheckpoint,ExternalDataError} from './external-data-config';
import type {AuthUser} from './auth';
type ExternalJob={id:string;source_id:string;app_id:string;actor_id:number;checkpoint:string};
function authorized<T>(source:ExternalSource,userId:number,work:()=>T){const user=db.prepare("SELECT id,name,COALESCE(email,'') email,role,active FROM _users WHERE id=?").get(userId) as AuthUser&{active:number}|undefined;if(!user?.active)throw new ExternalDataError('บัญชีที่สั่ง Sync ถูกปิดหรือลบ',403);return withApplication(applicationScopeFor(user,source.app_id),()=>runAuthorized(user,accessFor(user),()=>withAuditActor(user,'external-data-sync',()=>{if(!currentAccess().builder)throw new ExternalDataError('ผู้สั่ง Sync ไม่มีสิทธิ์พัฒนาแอปแล้ว',403);return work();})));}
async function runExternalJob(job:ExternalJob){const source=externalSource(job.source_id),config=sourceConfig(source),started=Date.now(),generation=databaseGeneration();let processed=0;let release:(()=>unknown)|undefined;
 try{if(!source.enabled)throw new ExternalDataError('Data Source ถูกพักใช้งาน');release=acquireExternalLease(source.id);const connection={...config.connection,query:{...config.connection.query}};if(config.incremental_path&&job.checkpoint)connection.query[config.incremental_parameter]=job.checkpoint;
  const result=await authorized(source,job.actor_id,()=>restDataConnector.collect(connection,source.id,source.app_id));processed=result.records.length;const rows=mapExternalRows(result.records,config.mapping);let checkpoint=source.checkpoint;
  if(config.incremental_path)for(const row of result.records)checkpoint=advanceExternalCheckpoint(checkpoint,resolveJsonPath(row,config.incremental_path));
  authorized(source,job.actor_id,()=>db.transaction(()=>{if(databaseGeneration()!==generation)throw new ExternalDataError('ฐานข้อมูลถูกกู้คืนระหว่าง Sync');const current=externalSource(source.id);if(!current.enabled||current.config_json!==source.config_json)throw new ExternalDataError('Data Source เปลี่ยนระหว่าง Sync');const counts=applyImportedRows(source,config,rows);db.prepare('UPDATE _external_sources SET checkpoint=? WHERE id=?').run(checkpoint,source.id);db.prepare("UPDATE _external_jobs SET status='succeeded',processed=?,created=?,updated=?,duration_ms=?,updated_at=?,checkpoint=? WHERE id=? AND status='running'").run(rows.length,counts.created,counts.updated,Date.now()-started,Date.now(),checkpoint,job.id);}).immediate());try{authorized(source,job.actor_id,()=>emitSourceWorkflowEvent(source,'sync_completed',job.id));}catch{/* Hook failures do not undo committed sync data. */}
 }catch(e){if(databaseGeneration()===generation)db.prepare("UPDATE _external_jobs SET status='failed',processed=?,failed=?,error=?,duration_ms=?,updated_at=? WHERE id=? AND status='running'").run(processed,processed,e instanceof ExternalDataError?e.message:'Sync ไม่สำเร็จ กรุณาตรวจ Mapping สิทธิ์ หรือเงื่อนไขของตารางปลายทาง',Date.now()-started,Date.now(),job.id);try{authorized(source,job.actor_id,()=>emitSourceWorkflowEvent(source,'sync_failed',job.id));}catch{/* Do not escalate privileges or replace the original sync result. */}}finally{release?.();}
}
// Called by the existing Automation worker, under its per-application scope. No additional timer.
export async function drainExternalSources(){if(currentDevelopment())return;const app=currentApplication()?.id||'default',now=Date.now();db.prepare("UPDATE _external_jobs SET status='failed',failed=1,error='งานหยุดระหว่างทำงาน กด Sync ใหม่เพื่อเริ่มจาก checkpoint ล่าสุด',updated_at=? WHERE app_id=? AND status='running' AND updated_at<?").run(now,app,now-5*60000);
 for(const source of db.prepare('SELECT * FROM _external_sources WHERE app_id=? AND enabled=1 AND next_sync_at>0 AND next_sync_at<=? ORDER BY next_sync_at LIMIT 5').all(app,now) as ExternalSource[]){const config=sourceConfig(source);db.transaction(()=>{if(!db.prepare('UPDATE _external_sources SET next_sync_at=? WHERE id=? AND next_sync_at=?').run(now+config.interval_minutes*60000,source.id,source.next_sync_at).changes)return;try{authorized(source,source.owner_id,()=>enqueueExternalSync(source.id));}catch{db.prepare("INSERT INTO _external_jobs(id,source_id,app_id,actor_id,status,created_at,updated_at,failed,error) VALUES(?,?,?,?,'failed',?,?,1,'ไม่มีสิทธิ์เริ่ม Scheduled Sync')").run(randomUUID(),source.id,app,source.owner_id,now,now);}}).immediate();}
 for(let i=0;i<1;i++){const job=db.transaction(()=>{const row=db.prepare("SELECT * FROM _external_jobs WHERE app_id=? AND status='queued' ORDER BY created_at,id LIMIT 1").get(app) as ExternalJob|undefined;if(!row)return;return db.prepare("UPDATE _external_jobs SET status='running',attempts=attempts+1,updated_at=? WHERE id=? AND status='queued'").run(Date.now(),row.id).changes?row:undefined;}).immediate();if(!job)break;await runExternalJob(job);}
}

const workerGlobal=globalThis as typeof globalThis & {__nocodeExternalApps?:Set<string>};
export function tickExternalSources(){if(currentDevelopment())return;const app=currentApplication()?.id||'default',active=workerGlobal.__nocodeExternalApps??=new Set();if(active.has(app)||active.size>=2)return;active.add(app);void drainExternalSources().catch(()=>{}).finally(()=>active.delete(app));}
