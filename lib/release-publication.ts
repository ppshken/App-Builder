import {releaseRevisionTriggers,releaseTrackedGlobals} from './release-data-revisions';
import type Database from 'better-sqlite3';
import {publicationDataStamp,validatePublicationInWorker,PublicationValidationError} from './publication-validation';
import {actionPermission} from './action-config';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,writeFileSync,unlinkSync,statfsSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {db,platformDatabase,databasePath,isIsolatedDatabase,databaseGeneration} from './db';
import {currentApplication,withApplication} from './application-context';
import {currentAccess,accessFor,runAuthorized} from './permissions';
import {applicationScopeFor} from './applications';
import {AuthError,type AuthUser} from './auth';
import {catalog,draftDiff,openDraft,isDevelopmentDraft,rehearsalPlanHash,applyReleaseCatalog} from './releases';
import {applyPublicationSchema,RELEASE_EXECUTOR_VERSION,type RehearsalResult} from './release-rehearsal';
import {publicationBlockers,samePublicationSource,requiresPublicationRowValidation,schemaPublicationEnabled} from './release-publication-policy';
import {publicationJournal,publicationJournalPath,claimPublication,assertPublicationLease,finishPublication} from './publication-journal';
import {openRehearsalQueue,rehearsalQueuePath,type RehearsalJob} from './rehearsal-jobs';
import {backupFolder,MAX_BACKUP_BYTES} from './backups';
import {auditTriggerDefinitions} from './audit-schema';
import {realtimeTriggerDefinitions} from './realtime-schema';
import type {ReleaseCatalog} from './release-plan';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function automaticGrantPreview(plan:ReturnType<typeof draftDiff>['plan'],desired:ReleaseCatalog){
 const app=currentApplication()!,roles=db.prepare('SELECT name,label FROM _application_local_roles WHERE app_id=? AND auto_grant=1 ORDER BY name').all(app.id) as {name:string;label:string}[];
 const tables=plan.operations.filter(o=>o.kind==='create_table').map(o=>({name:o.table!,label:String(desired._tables.find(t=>t.name===o.table)?.label||o.table),rights:{read:true,create:true,update:true,delete:true,export:true}}));
 const datasets={...app.datasets};for(const table of tables)datasets[table.name]=table.rights;
 const actions=plan.operations.filter(o=>o.id.startsWith('_actions:')&&o.kind==='create_configuration').flatMap(o=>{const action=desired._actions.find(a=>a.name===o.name);return action&&datasets[String(action.table_name)]?.read&&datasets[String(action.table_name)]?.[actionPermission(String(action.kind))]?[{name:String(action.name),label:String(action.label||action.name),table:String(action.table_name)}]:[];});
 return {roles:tables.length||actions.length?roles:[],tables,actions};
}
type Receipt={kind:'additive-v1';executor_version:string;plan_hash:string;attempt_id:string;intent_hash:string;backup:string;rehearsal_id:string;validation_id?:string;published_at:number};
function committed(id:string,owner:number,intent?:string){const row=db.prepare('SELECT owner,config_json FROM _app_versions WHERE id=?').get(id) as {owner:number;config_json:string}|undefined;if(!row)return null;if(row.owner!==owner)throw new AuthError('ไม่มีสิทธิ์อ่านผลเผยแพร่นี้',403);const r=JSON.parse(row.config_json)._publication?.[0] as Receipt|undefined;if(!r||intent&&r.intent_hash!==intent)throw new AuthError('รหัสเผยแพร่ไม่ตรงกับคำขอเดิม กรุณาตรวจประวัติ',409);if(r.attempt_id&&existsSync(publicationJournalPath(databasePath))){let journal:ReturnType<typeof publicationJournal>|undefined;try{journal=publicationJournal(databasePath);journal.prepare("UPDATE attempts SET status='committed',backup=?,updated_at=? WHERE id=? AND app_id=? AND workspace_id=? AND owner=? AND intent_hash=? AND status IN ('preparing','interrupted')").run(r.backup,Date.now(),r.attempt_id,currentApplication()!.id,id,owner,r.intent_hash);}catch{/* The committed SQLite receipt is authoritative when the sidecar is unavailable. */}finally{journal?.close();}}return {status:'committed' as const,versionId:id,backup:r.backup,publishedAt:r.published_at,replayed:true};}
function rehearsal(id:string,owner:number,planHash:string){
 const path=rehearsalQueuePath(databasePath);if(!existsSync(path))return null;const q=openRehearsalQueue(path);try{const row=q.prepare("SELECT * FROM jobs WHERE workspace_id=? AND app_id=? AND owner=? AND plan_hash=? AND status='passed' AND cancel_requested=0 ORDER BY created_at DESC LIMIT 1").get(id,currentApplication()!.id,owner,planHash) as RehearsalJob|undefined;if(!row?.result_json)return null;const result=JSON.parse(row.result_json);return result.status==='passed'&&result.planHash===planHash&&result.workspaceId===id&&result.appId===currentApplication()!.id&&result.expiresAt>Date.now()?row.id:null;}finally{q.close();}
}
function physical(database:Database.Database){return database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();}
function untrustedMetadataTrigger(database:Database.Database){
 const normalize=(s:string)=>s.trim().replace(/;$/,'');const trusted=new Map(auditTriggerDefinitions(database).map(t=>[t.name,normalize(t.sql)]));
 for(const table of releaseTrackedGlobals(database))for(const trigger of releaseRevisionTriggers(table))trusted.set(trigger.name,normalize(trigger.sql));
 for(const t of database.prepare('SELECT name FROM _tables').all() as {name:string}[])for(const trigger of realtimeTriggerDefinitions(t.name))trusted.set(trigger.name,normalize(trigger.sql));
 return (database.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name NOT LIKE 't_%'").all() as {name:string;tbl_name:string;sql:string}[]).some(t=>trusted.get(t.name)!==normalize(t.sql));
}
export function publicationReview(id:string,owner:number,verified?:RehearsalResult){
 if(!currentAccess().builder||isIsolatedDatabase())throw new AuthError('ตรวจเผยแพร่จากบริบทแอปจริงโดยผู้พัฒนาเท่านั้น',403);
 const done=committed(id,owner);if(done)return {committed:done,eligible:false,blockers:[],intentHash:'',rehearsalId:null};
 const review=draftDiff(id,owner);if(!isDevelopmentDraft(review.manifest))throw new AuthError('เลือกพื้นที่พัฒนาโครงสร้างก่อน',409);
 const opened=openDraft(id,owner);let desired:ReleaseCatalog;try{desired=catalog(opened);}finally{opened.close();}
 const app=currentApplication()!,live=catalog(),shared=(db.prepare('SELECT DISTINCT table_name FROM _application_datasets WHERE app_id<>? AND can_read=1').all(app.id) as {table_name:string}[]).map(r=>r.table_name),auto=Number((db.prepare('SELECT count(*) n FROM _application_local_roles WHERE app_id=? AND auto_grant=1').get(app.id) as {n:number}).n);
 const blockers=publicationBlockers(review.plan,live,desired,shared,auto),planHash=rehearsalPlanHash(review),rehearsalId=verified?.status==='passed'&&verified.workspaceId===id&&verified.appId===app.id&&verified.planHash===planHash&&verified.expiresAt>Date.now()?verified.id:rehearsal(id,owner,planHash);
 if(!schemaPublicationEnabled())blockers.push('เซิร์ฟเวอร์ยังไม่เปิดเผยแพร่โครงสร้าง กรุณาทดสอบ staging ก่อนตั้ง NOCODE_SCHEMA_PUBLICATION=1 การใช้งานแอปและการซ้อมยังทำได้ตามปกติ');
 const validatesRows=requiresPublicationRowValidation(review.plan,desired),automaticGrants=automaticGrantPreview(review.plan,desired);
 if(Number(platformDatabase().pragma('page_count',{simple:true}))*Number(platformDatabase().pragma('page_size',{simple:true}))>MAX_BACKUP_BYTES)blockers.push('รุ่นแรกเผยแพร่ฐานข้อมูลไม่เกิน 512 MB ตามขีดจำกัดกู้คืนเดิม');
 if(review.health.errors)blockers.push('การตรวจความพร้อมพบข้อผิดพลาด กรุณาแก้ในพื้นที่พัฒนาก่อน');
 if(!rehearsalId)blockers.push('ต้องมีผลซ้อมเบื้องหลังที่ผ่าน ตรงกับแผน และยังไม่หมดอายุ');
 if(!review.plan.operations.length)blockers.push('ไม่มีความเปลี่ยนแปลงที่ต้องเผยแพร่');
 if(untrustedMetadataTrigger(platformDatabase()))blockers.push('พบ Trigger นอกระบบในตารางตั้งค่า กรุณาตรวจก่อนเผยแพร่');
 const permissions={datasets:app.datasets,auto,builders:db.prepare('SELECT user_id FROM _application_builders WHERE app_id=? ORDER BY user_id').all(app.id),roles:db.prepare('SELECT * FROM _application_local_roles WHERE app_id=? ORDER BY name').all(app.id),grants:['_roles','_role_tables','_role_actions','_role_row_rules'].map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()),localGrants:['_application_role_tables','_application_role_actions','_application_role_rows'].map(t=>db.prepare('SELECT * FROM '+t+' WHERE app_id=? ORDER BY rowid').all(app.id))};
 const intentHash=hash({workspace:id,app:app.id,owner,planHash,reviewHash:review.review_hash,physical:physical(platformDatabase()),permissions});
 return {eligible:!blockers.length,blockers:[...new Set(blockers)],intentHash,rehearsalId,planHash,reviewHash:review.review_hash,validatesRows,validationLimit:1000000,automaticGrants,committed:null};
}
export async function publishDevelopment(id:string,owner:number,intent:string,reauth:()=>AuthUser|null,aborted:()=>boolean,automaticGrantsAck=false){
 const appId=currentApplication()!.id,done=committed(id,owner,intent);if(done)return done;
 const initial=publicationReview(id,owner);if(!initial.eligible||initial.intentHash!==intent)throw new AuthError('แผนหรือสิทธิ์เปลี่ยน หรือยังไม่ผ่านเงื่อนไข กรุณาตรวจพร้อมเผยแพร่อีกครั้ง',409);
 if(initial.automaticGrants?.roles.length&&!automaticGrantsAck)throw new AuthError('กรุณายืนยันสิทธิ์อัตโนมัติที่แสดงในผลตรวจพร้อมเผยแพร่',409);
 let journal:ReturnType<typeof publicationJournal>;try{journal=publicationJournal(databasePath);}catch{throw new AuthError('ที่เก็บสถานะเผยแพร่ไม่พร้อม กรุณาลองใหม่ภายหลัง',409);}let attempt:ReturnType<typeof claimPublication>|undefined,backup:string|undefined,backupPath:string|undefined,backupComplete=false,backupCreated=false;
 const identity=()=>{const stat=statSync(databasePath,{bigint:true});return stat.dev+':'+stat.ino;};
 try{
 const stampTables=catalog()._tables.filter(t=>currentApplication()?.datasets?.[String(t.name)]?.read&&t.source_kind!=='EXTERNAL_REST_API').map(t=>String(t.name));
 const source={connection:platformDatabase(),generation:databaseGeneration(),identity:identity()};
  attempt=claimPublication(journal,appId,id,owner,intent);const raw=platformDatabase(),size=Number(raw.pragma('page_count',{simple:true}))*Number(raw.pragma('page_size',{simple:true})),space=statfsSync(dirname(databasePath));if(size>MAX_BACKUP_BYTES||space.bavail*space.bsize<size*2+64*1024**2)throw Error('พื้นที่สำรองไม่เพียงพอ');
  let verifiedStamp:string|undefined,validationId:string|undefined,verifiedResult:RehearsalResult|undefined;
  if(initial.validatesRows){
   verifiedStamp=publicationDataStamp(raw,stampTables);
   const validation=await validatePublicationInWorker({databasePath,workspaceId:id,appId,owner,planHash:initial.planHash!},()=>{assertPublicationLease(journal,attempt!);journal.prepare("UPDATE attempts SET lease_until=?,updated_at=? WHERE id=? AND token=? AND status='preparing'").run(Date.now()+10*60000,Date.now(),attempt!.id,attempt!.token);},aborted);
   if(validation.coverage?.mode==='sample')throw new AuthError('ต้องตรวจข้อมูลครบก่อนเผยแพร่',409);
   if(validation.status!=='passed')throw new PublicationValidationError(validation);
   if(publicationDataStamp(raw,stampTables)!==verifiedStamp)throw new AuthError('มีข้อมูลเปลี่ยนระหว่างตรวจล่าสุด กรุณากดเผยแพร่อีกครั้ง ระบบจะตรวจใหม่โดยไม่ต้องสร้างพื้นที่พัฒนาใหม่',409);
   validationId=validation.id;verifiedResult=validation;
  }
  backup='data.backup-schema-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.db';backupPath=join(backupFolder(databasePath),backup);writeFileSync(backupPath,'',{mode:0o600,flag:'wx'});backupCreated=true;
  await raw.backup(backupPath,{progress:()=>{assertPublicationLease(journal,attempt!);if(aborted())throw Error('คำขอถูกยกเลิก');return 256;}});backupComplete=true;journal.prepare('UPDATE attempts SET backup=? WHERE id=? AND token=?').run(backup,attempt.id,attempt.token);
  if(!samePublicationSource(source,{connection:platformDatabase(),generation:databaseGeneration(),identity:identity()}))throw new AuthError('ฐานข้อมูลถูกเปลี่ยนหรือกู้คืนระหว่างสำรอง กรุณาตรวจใหม่',409);
  const actor=reauth();if(aborted()||!actor||actor.id!==owner)throw new AuthError('บัญชีหรือ Session เปลี่ยน กรุณาเข้าสู่ระบบและตรวจใหม่',403);
  const application=applicationScopeFor(actor,appId);
  return withApplication(application,()=>runAuthorized(actor,accessFor(actor),()=>{
   if(!currentAccess().builder)throw new AuthError('สิทธิ์ผู้พัฒนาถูกเปลี่ยน ยกเลิกการเผยแพร่',403);
   const opened=openDraft(id,owner);try{return opened.transaction(()=>raw.transaction(()=>{
    if(!samePublicationSource(source,{connection:platformDatabase(),generation:databaseGeneration(),identity:identity()}))throw new AuthError('ฐานข้อมูลต้นทางเปลี่ยนก่อน commit',409);
    const latestActor=reauth();if(!latestActor||latestActor.id!==owner)throw new AuthError('Session หรือบัญชีเปลี่ยนก่อน commit',403);const latestApplication=applicationScopeFor(latestActor,appId);
    return withApplication(latestApplication,()=>runAuthorized(latestActor,accessFor(latestActor),()=>{
    if(!currentAccess().builder)throw new AuthError('สิทธิ์ผู้พัฒนาถูกถอนก่อน commit',403);
    if(verifiedStamp&&publicationDataStamp(raw,stampTables)!==verifiedStamp)throw new AuthError('มีข้อมูลเปลี่ยนก่อน commit กรุณากดเผยแพร่อีกครั้งเพื่อตรวจล่าสุด',409);
    assertPublicationLease(journal,attempt!);const already=committed(id,owner,intent);if(already){finishPublication(journal,attempt!,'committed',backup);return already;}
    const fresh=publicationReview(id,owner,verifiedResult);if(!fresh.eligible||fresh.intentHash!==intent)throw new AuthError('การตั้งค่า โครงสร้าง หรือสิทธิ์เปลี่ยนระหว่างสำรอง ยกเลิกการเผยแพร่',409);
    const before=catalog(),review=draftDiff(id,owner),desired=catalog(opened);if(hash(desired)!==fresh.reviewHash)throw new AuthError('พื้นที่พัฒนาเปลี่ยนระหว่างเผยแพร่ กรุณาตรวจใหม่',409);
    const extra=review.plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table!);const scoped={...latestApplication,datasets:{...latestApplication.datasets}};for(const table of extra)scoped.datasets[table]={read:true,create:true,update:true,delete:true,export:true};
    const receipt:Receipt={kind:'additive-v1',executor_version:RELEASE_EXECUTOR_VERSION,plan_hash:fresh.planHash!,attempt_id:attempt!.id,intent_hash:intent,backup:backup!,rehearsal_id:initial.rehearsalId!,validation_id:validationId,published_at:Date.now()};let saved:ReleaseCatalog|undefined;
    withApplication(scoped,()=>runAuthorized(latestActor,accessFor(latestActor),()=>applyPublicationSchema(raw,review.plan,before,desired,next=>{
     applyReleaseCatalog(next,true);

     saved=next;
    })));
    assertPublicationLease(journal,attempt!);db.prepare('INSERT INTO _app_versions(id,owner,label,created_at,config_json,before_json) VALUES(?,?,?,?,?,?)').run(id,owner,review.manifest.label,receipt.published_at,JSON.stringify({...saved,_publication:[receipt]}),JSON.stringify(before));
    return {status:'committed' as const,versionId:id,backup:backup!,publishedAt:receipt.published_at,replayed:false};
    }));
   }).immediate())();}finally{opened.close();}
  }));
 }catch(e){
  // A committed SQLite version is authoritative even if status delivery/journaling was interrupted.
  const actual=committed(id,owner,intent);if(actual)return actual;
  if(attempt)try{finishPublication(journal,attempt,'failed',backupComplete?backup:undefined);}catch{}
  if(backupPath&&backupCreated&&!backupComplete)try{unlinkSync(backupPath);}catch{}
  if(e instanceof AuthError)throw e;throw new AuthError('เผยแพร่ไม่สำเร็จ ไม่มีการ commit โครงสร้างหรือการตั้งค่าบางส่วน กรุณาตรวจแล้วลองใหม่',409);
 }finally{
  try{if(attempt&&committed(id,owner,intent))try{finishPublication(journal,attempt,'committed',backup);}catch{}}finally{journal.close();}
 }
}
