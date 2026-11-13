import {withPublicationArchiveGuard} from './publication-journal';
import {initializeDevelopment,verifyDevelopment,developmentOrigins} from './development-workspace';
import {developmentAccess} from './development-workspace';
import {withDevelopment} from './development-context';
import {withApplication} from './application-context';
import {currentUser,currentAccess,runAuthorized} from './permissions';
import {withoutWorkflows} from './workflows';
import {RELEASE_EXECUTOR_VERSION,applyRehearsalSchema,dataFingerprint,rehearsalEligibility,validateReleaseRows,type RehearsalResult} from './release-rehearsal';
import {calculateRow,validateRow} from './columns';
import {expressionContext} from './expression-context';
import {analyzeReleasePlan} from './release-plan';
import {pruneApplicationActionGrants} from './application-role-grants';
import {currentApplication} from './application-context';
import {applicationDatabase} from './db';
import Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync,renameSync,chmodSync,rmSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {db,databasePath,withDatabase} from './db';
import {installAuditing} from './audit-schema';
import {readColumns} from './schema';
import {inspectApp} from './readiness';
import {AuthError} from './auth';
const META=['_table_overlays','_tables','_columns','_slices','_views','_actions','_app_settings','_pdf_templates','_automations'] as const;
type Catalog=Record<string,Record<string,any>[]>;
type Manifest={id:string;label:string;owner:number;created_at:number;base_hash:string;status:'draft'|'published'|'archived';published_at?:number;workspace_mode?:'development';format_version?:2;source_app_id?:string;expires_at?:number;schema_release?:number};
export const DRAFT_COOKIE='nocode_draft';
function versions(){db.exec("CREATE TABLE IF NOT EXISTS _app_versions(id TEXT PRIMARY KEY,owner INTEGER NOT NULL,label TEXT NOT NULL,created_at INTEGER NOT NULL,config_json TEXT NOT NULL,before_json TEXT NOT NULL)");}
const folder=()=>{const root=join(dirname(databasePath),'.app-releases',currentApplication()?.id&&currentApplication()?.id!=='default'?currentApplication()!.id:'');mkdirSync(root,{recursive:true});return root;};
function valid(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('รหัสฉบับร่างไม่ถูกต้อง');return id;}
function file(id:string,ext:string){return join(folder(),valid(id)+ext);}
function json(path:string){return JSON.parse(readFileSync(path,'utf8'));}
function save(path:string,value:unknown){const tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value),{mode:0o600});renameSync(tmp,path);}
export function catalog(database:Database.Database=db):Catalog{if(database!==db&&currentApplication())database=applicationDatabase(database,currentApplication()!.id);return Object.fromEntries(META.map(table=>[table,(database.prepare('SELECT * FROM '+table+' ORDER BY rowid').all() as Record<string,any>[]).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>!(table==='_automations'&&k==='next_run_at'))))]));}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function draftManifest(id:string,owner:number){versions();valid(id);const published=db.prepare('SELECT id,owner,label,created_at FROM _app_versions WHERE id=?').get(id) as {id:string;owner:number;label:string;created_at:number}|undefined;const m=published?{...published,status:'published',base_hash:''} as Manifest:json(file(id,'.json')) as Manifest;if(m.owner!==owner)throw new AuthError('ไม่มีสิทธิ์เปิดฉบับร่างนี้',403);return m;}
export function developmentDatabaseFile(id:string){return join(folder(),valid(id),'workspace.db');}
export function isDevelopmentDraft(m:Manifest){return m.workspace_mode==='development'&&m.format_version===2;}
export function openDraft(id:string,owner:number){const m=draftManifest(id,owner);if(m.status!=='draft')throw new AuthError('ฉบับร่างนี้ไม่ได้เปิดใช้งานแล้ว กรุณากลับเวอร์ชันจริง',409);if(isDevelopmentDraft(m)&&m.source_app_id!==(currentApplication()?.id||'default'))throw new AuthError('พื้นที่พัฒนาไม่ตรงกับแอปนี้',403);if(m.expires_at&&m.expires_at<Date.now())throw new AuthError('พื้นที่พัฒนาหมดอายุ กรุณาเก็บและสร้างพื้นที่ใหม่',409);const target=isDevelopmentDraft(m)?developmentDatabaseFile(id):file(id,'.db');if(!existsSync(target))throw new AuthError('ไม่พบฐานข้อมูลพื้นที่พัฒนา กรุณาสร้างใหม่',409);const opened=new Database(target,{fileMustExist:true});try{if(isDevelopmentDraft(m))verifyDevelopment(opened,id,m.source_app_id!);installAuditing(opened);opened.pragma('foreign_keys=ON');return opened;}catch(error){opened.close();throw error;}}
export function listReleases(owner:number){versions();const saved=(db.prepare("SELECT id,owner,label,created_at,CASE WHEN json_valid(config_json) THEN CASE WHEN json_type(config_json,'$._publication')='array' THEN 1 ELSE 0 END ELSE 0 END AS schema_release FROM _app_versions WHERE owner=?").all(owner) as any[]).map(m=>({...m,status:'published',base_hash:''}) as Manifest);const drafts=readdirSync(folder()).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).flatMap(n=>{try{const m=json(join(folder(),n)) as Manifest;return m.owner===owner?[m]:[];}catch{return [];}});return Array.from(new Map([...drafts,...saved].map(m=>[m.id,m])).values()).sort((a,b)=>b.created_at-a.created_at);}
export function createDraft(owner:number,label:string,version?:string,before=false,mode:"configuration"|"development"="configuration"){
 if(listReleases(owner).filter(m=>m.status==='draft').length>=10)throw Error('มีฉบับร่างครบ 10 ฉบับแล้ว กรุณาเผยแพร่หรือลบฉบับที่ไม่ใช้');
 if(typeof label!=='string'||!label.trim()||label.length>100)throw Error('ตั้งชื่อฉบับร่าง 1–100 ตัวอักษร');
 if(!['configuration','development'].includes(mode)||mode==='development'&&version)throw Error('รูปแบบพื้นที่พัฒนาไม่ถูกต้อง');
 if(version){const saved=db.prepare('SELECT config_json FROM _app_versions WHERE id=? AND owner=?').get(version,owner) as {config_json:string}|undefined;if(saved&&JSON.parse(saved.config_json)._publication)throw new AuthError('เวอร์ชันนี้มีการเพิ่มโครงสร้าง กรุณาสร้างเวอร์ชันถัดไปแทนการย้อนอัตโนมัติ',409);}
 const id=randomUUID(),baseline=catalog(),development=mode==='development',appId=currentApplication()?.id||'default';
 const target=development?developmentDatabaseFile(id):file(id,'.db');let createdDevelopmentDirectory=false;
 if(existsSync(file(id,'.json'))||existsSync(file(id,'.baseline.json'))||existsSync(file(id,'.db')))throw new AuthError('รหัสพื้นที่ซ้ำ กรุณาลองใหม่',409);
 try{
  if(development){mkdirSync(dirname(target),{mode:0o700});createdDevelopmentDirectory=true;}
  db.prepare('VACUUM INTO ?').run(target);
  if(development){
   chmodSync(target,0o600);const opened=new Database(target);
   try{
    if(hash(catalog(opened))!==hash(baseline))throw new AuthError('การตั้งค่าจริงเปลี่ยนระหว่างสร้างพื้นที่พัฒนา กรุณาลองใหม่',409);
    installAuditing(opened);opened.pragma('foreign_keys=ON');
    const allowed=new Set([...Object.entries(currentApplication()?.datasets||{}).filter(([,r])=>r.read).map(([name])=>name),...baseline._tables.filter(t=>t.owner_app_id===appId).map(t=>String(t.name))]);
    opened.transaction(()=>initializeDevelopment(opened,id,appId,[...allowed]))();
   }finally{opened.close();}
  }
  const m:Manifest={id,label:label.trim(),owner,created_at:Date.now(),base_hash:hash(baseline),status:'draft',...(development?{workspace_mode:'development',format_version:2,source_app_id:appId,expires_at:Date.now()+14*86400000}:{})};
  save(file(id,'.baseline.json'),baseline);save(file(id,'.json'),m);
  if(version){const source=draftManifest(version,owner);if(source.status!=='published')throw Error('เลือกเวอร์ชันที่เผยแพร่แล้ว');const saved=db.prepare('SELECT config_json,before_json FROM _app_versions WHERE id=?').get(version) as {config_json:string;before_json:string};const snapshot=JSON.parse(before?saved.before_json:saved.config_json) as Catalog,opened=openDraft(id,owner);try{withDatabase(opened,()=>applyReleaseCatalog(snapshot));}finally{opened.close();}}
  return m;
 }catch(error){
  if(development&&createdDevelopmentDirectory){
   // Only this newly-created UUID directory may be removed, never a live DB or another draft.
   const root=resolve(folder()),created=resolve(dirname(target));
   if(relative(root,created)===id){try{rmSync(created,{recursive:true,force:true});rmSync(file(id,'.baseline.json'),{force:true});rmSync(file(id,'.json'),{force:true});}catch{/* Keep the original failure; private orphan files can be inspected by the administrator. */}}
  }
  throw error;
 }
}

function structural(c:Catalog){return {tables:c._tables.map(t=>t.name).sort(),columns:c._columns.map(c=>[c.id,c.table_name,c.name,c.type,c.is_virtual,c.is_key,c.is_unique,c.ref_table]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};}
export function applyReleaseCatalog(c:Catalog,changedOnly=false){const current=catalog();if(hash(structural(current))!==hash(structural(c)))throw new AuthError('โครงสร้างตารางต่างกัน รุ่นนี้เผยแพร่ได้เฉพาะสูตรและการตั้งค่า กรุณาแปลงโครงสร้างในเวอร์ชันจริงก่อนสร้างฉบับร่างใหม่',409);
db.transaction(()=>{for(const table of META){for(const row of c[table]||current[table]){if(changedOnly&&current[table].some(old=>JSON.stringify(old)===JSON.stringify(row)))continue;const scheduled=table==='_automations'?db.prepare('SELECT next_run_at,config_json,enabled FROM _automations WHERE name=?').get(row.name) as any:null;const data=table==='_automations'?{...row,next_run_at:scheduled&&scheduled.config_json===row.config_json&&scheduled.enabled===row.enabled?scheduled.next_run_at:Date.now()+JSON.parse(row.config_json).interval_minutes*60000}:row;const key=table==='_table_overlays'?'table_name':['_columns','_app_settings'].includes(table)?'id':'name',keys=Object.keys(data);db.prepare('INSERT INTO '+table+'('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map(()=>'?').join(',')+') ON CONFLICT('+key+') DO UPDATE SET '+keys.filter(k=>k!==key).map(k=>'"'+k+'"=excluded."'+k+'"').join(',')).run(...keys.map(k=>data[k]));}}
for(const table of ['_table_overlays','_automations','_pdf_templates','_actions','_views','_slices']){const key=table==='_table_overlays'?'table_name':'name';const names=(c[table]||current[table]).map(r=>r[key]);db.prepare('DELETE FROM '+table+' WHERE '+key+' NOT IN (SELECT value FROM json_each(?))').run(JSON.stringify(names));}
pruneApplicationActionGrants(db);const report=inspectApp();if(report.errors)throw Error('เผยแพร่ไม่ได้: '+report.issues.filter(i=>i.severity==='error').map(i=>i.label+': '+i.message).slice(0,5).join(' · '));for(const table of c._tables)readColumns(db,table.name);if((db.pragma('foreign_key_check') as unknown[]).length)throw Error('การตั้งค่าอ้างอิงไม่ครบ ย้อนการเผยแพร่แล้ว');})();}

export function draftDiff(id:string,owner:number){const m=draftManifest(id,owner),opened=openDraft(id,owner);try{const current=catalog(),next=catalog(opened),base=json(file(id,'.baseline.json')) as Catalog;const application=currentApplication(),appId=application?.id||'default';const tableNames=Object.entries(application?.datasets||{}).filter(([,rights])=>rights.read).map(([name])=>name);const sharedTables=(db.prepare('SELECT DISTINCT table_name FROM _application_datasets WHERE app_id<>? AND can_read=1').all(appId) as {table_name:string}[]).map(row=>row.table_name);const origins=isDevelopmentDraft(m)?developmentOrigins(opened):undefined;const plan=analyzeReleasePlan(base,current,next,{appId,workspaceId:id,tableNames,sharedTables,origins,legacyConflict:hash(current)!==m.base_hash});if(isDevelopmentDraft(m)){plan.blockers.push({code:'DEVELOPMENT_PREVIEW_ONLY',message:'พื้นที่พัฒนาโครงสร้างยังเผยแพร่ไม่ได้ ใช้ตรวจแผนและทดสอบในพื้นที่แยกเท่านั้น'});plan.publishBlocked=true;}return {plan,manifest:m,review_hash:hash(next),conflict:hash(current)!==m.base_hash,changes:META.map(table=>{const key=table==='_table_overlays'?'table_name':['_columns','_app_settings'].includes(table)?'id':'name',old=new Map((base[table]||[]).map(r=>[String(r[key]),r])),fresh=new Map(next[table].map(r=>[String(r[key]),r]));const items=Array.from(new Set([...old.keys(),...fresh.keys()])).flatMap(id=>{const a=old.get(id),b=fresh.get(id);if(JSON.stringify(a)===JSON.stringify(b))return [];const fields=Array.from(new Set([...Object.keys(a||{}),...Object.keys(b||{})])).filter(k=>JSON.stringify(a?.[k])!==JSON.stringify(b?.[k])).map(name=>({name,before:a?.[name],after:b?.[name]}));return [{key:id,label:String(b?.label||a?.label||b?.name||a?.name||id),operation:!a?'create':!b?'delete':'update',fields}];});return {table,changed:items.length>0,before:(base[table]||[]).length,after:next[table].length,items};}).filter(x=>x.changed),health:withDatabase(opened,()=>{const actor=currentUser();if(isDevelopmentDraft(m)&&application&&actor){const scoped=developmentAccess(opened,application,currentAccess());return withApplication(scoped.application,()=>runAuthorized(actor,scoped.access,()=>inspectApp()));}return inspectApp();})};}finally{opened.close();}}
export function publishDraft(id:string,owner:number,expectedHash:string){const m=draftManifest(id,owner);if(m.status!=='draft')throw Error('ฉบับร่างนี้เผยแพร่แล้ว');if(isDevelopmentDraft(m))throw new AuthError('พื้นที่พัฒนาโครงสร้างยังไม่รองรับการเผยแพร่ กรุณาตรวจและซ้อมแผนในระยะถัดไป',409);const opened=openDraft(id,owner);try{const snapshot=catalog(opened);if(expectedHash!==hash(snapshot))throw new AuthError('ฉบับร่างเปลี่ยนหลังตรวจ กรุณาตรวจอีกครั้ง',409);db.transaction(()=>{if(hash(catalog())!==m.base_hash)throw new AuthError('เวอร์ชันจริงเปลี่ยนหลังสร้างฉบับร่าง กรุณาสร้างฉบับร่างใหม่เพื่อรวมการแก้ไข',409);const baseline=catalog();save(file(id,'.before.json'),baseline);applyReleaseCatalog(snapshot);db.prepare('INSERT INTO _app_versions(id,owner,label,created_at,config_json,before_json) VALUES(?,?,?,?,?,?)').run(id,owner,m.label,Date.now(),JSON.stringify(snapshot),JSON.stringify(baseline));}).immediate();m.status='published';m.published_at=Date.now();try{save(file(id,'.json'),m);}catch{}return m;}finally{opened.close();}}
export function reviewedDraft(id:string,owner:number){const review=draftDiff(id,owner);return {...review,rehearsal_hash:rehearsalPlanHash(review),rehearsal:latestRehearsal(id,owner,review)};}

export function rehearsalPlanHash(review:ReturnType<typeof draftDiff>){return hash({executor:RELEASE_EXECUTOR_VERSION,plan:review.plan,review:review.review_hash});}
export type RehearsalControl={jobId:string;limit:number;deadline:number;checkpoint:(stage:string,processed?:number,total?:number)=>void;cancelled:()=>boolean};
export async function rehearseDraft(id:string,owner:number,expectedHash:string,control?:RehearsalControl){
 const started=Date.now(),review=draftDiff(id,owner),manifest=review.manifest,app=currentApplication(),user=currentUser();
 if(!isDevelopmentDraft(manifest)||!app||!user)throw new AuthError('เลือกพื้นที่พัฒนาโครงสร้างของแอปนี้ก่อนซ้อม',409);
 const planHash=rehearsalPlanHash(review);if(expectedHash!==planHash)throw new AuthError('แผนเปลี่ยนหลังตรวจ กรุณาตรวจใหม่ก่อนซ้อม',409);
 const limit=control?.limit??2000,deadline=control?.deadline??started+15000,checkpoint=(stage:string,processed=0,total=0)=>{if(Date.now()>deadline)throw Error('หมดเวลาซ้อม');control?.checkpoint(stage,processed,total);};
 const job=control?.jobId||randomUUID(),directory=join(dirname(developmentDatabaseFile(id)),'rehearsal-'+job),target=join(directory,'rehearsal.db');
 const result:RehearsalResult={id:job,workspaceId:id,appId:app.id,status:'blocked',createdAt:started,expiresAt:started+3600000,durationMs:0,planHash,tables:[],checks:[],reasons:[],publishAllowed:false};
 let opened:Database.Database|undefined,created=false,stage='SNAPSHOT';
 try{
  mkdirSync(directory,{mode:0o700});created=true;
  checkpoint('SNAPSHOT');if(control)await db.backup(target,{progress:p=>{checkpoint('SNAPSHOT',p.totalPages-p.remainingPages,p.totalPages);return 256;}});else db.prepare('VACUUM INTO ?').run(target);chmodSync(target,0o600);opened=new Database(target,{fileMustExist:true});
  stage='SNAPSHOT_CHECK';installAuditing(opened);opened.pragma('foreign_keys=ON');
  // The snapshot must still match the reviewed live metadata; row writes are intentionally allowed.
  if(hash(catalog(opened))!==hash(catalog())||rehearsalPlanHash(draftDiff(id,owner))!==planHash)throw new AuthError('การตั้งค่าจริงเปลี่ยนระหว่างสร้างสำเนาซ้อม กรุณาตรวจใหม่',409);
  stage='WORKSPACE_READ';const workspace=openDraft(id,owner);let desired:Catalog;try{desired=catalog(workspace);}finally{workspace.close();}
  if(hash(desired)!==review.review_hash)throw new AuthError('พื้นที่พัฒนาเปลี่ยนระหว่างเริ่มซ้อม กรุณาตรวจใหม่',409);
  const live=catalog(opened),names=live._tables.filter(t=>app.datasets?.[String(t.name)]?.read&&t.source_kind==='INTERNAL_DATABASE').map(t=>String(t.name));
  stage='ELIGIBILITY';const unsupported=rehearsalEligibility(review.plan,live,desired);if(unsupported.length){result.reasons=unsupported;return finish();}
  stage='LINEAGE';initializeDevelopment(opened,job,app.id,names);
  const scoped=developmentAccess(opened,app,currentAccess()),database=opened;
  await withDatabase(database,()=>withApplication(scoped.application,()=>runAuthorized(user,scoped.access,()=>withDevelopment({id:job,sourceAppId:app.id,databaseFile:target},()=>withoutWorkflows(async()=>{
   const shared=new Set((database.prepare('SELECT DISTINCT table_name FROM _application_datasets WHERE app_id<>? AND can_read=1').all(app.id) as {table_name:string}[]).map(t=>t.table_name));
   if(review.plan.operations.some(o=>o.category==='schema'&&shared.has(o.table!))){result.reasons.push('ยังไม่ซ้อมโครงสร้างตารางที่มีแอปอื่นเชื่อมอยู่');return;}
   stage='FINGERPRINT';const before=dataFingerprint(database,names,limit,deadline,undefined,n=>checkpoint('FINGERPRINT',n));result.dataHash=before.hash;
   const columns=Object.fromEntries(names.map(name=>[name,(database.pragma('table_info("t_'+name+'")') as {name:string}[]).map(c=>c.name)]));
   for(const o of review.plan.operations.filter(o=>o.kind==='create_table'))scoped.application.datasets[o.table!]={read:true,create:true,update:true,delete:true,export:true};
   stage='SCHEMA';checkpoint(stage);applyRehearsalSchema(database,review.plan,live,desired,applyReleaseCatalog);
   stage='PRESERVATION';
   // Hash the original columns again; additional nullable fields must not change old values.
   const preserved=dataFingerprint(database,names,limit,deadline,columns,n=>checkpoint('PRESERVATION',n)).hash===before.hash;
   const afterNames=desired._tables.filter(t=>scoped.application.datasets?.[String(t.name)]?.read&&t.source_kind==='INTERNAL_DATABASE').map(t=>String(t.name));
   // Include newly added tables in permission context for expression validation.
   for(const o of review.plan.operations.filter(o=>o.kind==='create_table')){scoped.application.datasets[o.table!]={read:true,create:true,update:true,delete:true,export:true};if(!afterNames.includes(o.table!))afterNames.push(o.table!);}
   result.tables=afterNames.map(table=>({table,before:before.tables.find(t=>t.table===table)?.rows||0,after:Number((database.prepare('SELECT count(*) n FROM "t_'+table+'"').get() as {n:number}).n)}));
   const fk=(database.pragma('foreign_key_check') as {table:string}[]).filter(r=>afterNames.some(t=>r.table==='t_'+t));
   stage='ROW_VALIDATION';const {invalid,checked,issues,omittedIssueRows}=validateReleaseRows(database,afterNames,{limit,deadline,now:new Date(),email:user.email||'',collectIssues:true,checkpoint:n=>checkpoint(stage,n,before.tables.reduce((n,t)=>n+t.rows,0))});
   result.rowIssues=issues;result.omittedIssueRows=omittedIssueRows;
   result.checks=[{code:'ORIGINAL_DATA_PRESERVED',passed:preserved},{code:'ROW_COUNTS',passed:result.tables.every(t=>t.before===t.after)},{code:'FOREIGN_KEYS',passed:fk.length===0,count:fk.length},{code:'ROW_VALIDATION',passed:invalid===0,count:invalid},{code:'ROWS_CHECKED',passed:true,count:checked}];
   result.status=result.checks.every(c=>c.passed)?'passed':'failed';
   if(result.status==='failed')result.reasons.push('ข้อมูลอ้างอิงหรือเงื่อนไขข้อมูลไม่ผ่าน ดูจำนวนปัญหาในผลตรวจ โดยไม่แสดงค่าข้อมูล');
  })))));
 }catch(error){
  console.error('[release-rehearsal]',{job,stage,errorType:error instanceof Error?error.name:'unknown'});
  result.checks.push({code:stage,passed:false});
  result.status='failed';result.reasons.push(control?.cancelled()?'ยกเลิกงานซ้อมแล้ว':error instanceof AuthError?'บริบทหรือแผนเปลี่ยน กรุณาตรวจใหม่ก่อนซ้อม':'ซ้อมไม่สำเร็จ: ตรวจโครงสร้าง สูตร เงื่อนไขข้อมูล หรือขีดจำกัดแถวและเวลาของงาน');
 }finally{
  opened?.close();
  // Delete only the UUID child directory created by this request, never the workspace/live DB.
  if(created){const root=resolve(dirname(developmentDatabaseFile(id))),child=resolve(directory);if(relative(root,child)==='rehearsal-'+job)rmSync(child,{recursive:true,force:true});}
 }
 return finish();
 function finish(){result.durationMs=Date.now()-started;if(!control)save(file(id,'.rehearsal.json'),result);return result;}
}
export function latestRehearsal(id:string,owner:number,review:ReturnType<typeof draftDiff>){draftManifest(id,owner);if(!existsSync(file(id,'.rehearsal.json')))return null;const result=json(file(id,'.rehearsal.json')) as RehearsalResult;let stale=result.expiresAt<Date.now()||result.planHash!==rehearsalPlanHash(review);if(!stale&&result.dataHash)try{const names=catalog()._tables.filter(t=>currentApplication()?.datasets?.[String(t.name)]?.read&&t.source_kind==='INTERNAL_DATABASE').map(t=>String(t.name));stale=db.transaction(()=>dataFingerprint(db,names).hash!==result.dataHash)();}catch{stale=true;}return {...result,stale};}

export function draftCookie(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(DRAFT_COOKIE+'='))?.slice(DRAFT_COOKIE.length+1)||'';}

export function archiveDraft(id:string,owner:number){return withPublicationArchiveGuard(databasePath,currentApplication()?.id||'default',id,()=>{const m=draftManifest(id,owner);if(m.status!=='draft')throw Error('เก็บได้เฉพาะฉบับร่างที่ยังไม่เผยแพร่');m.status='archived';save(file(id,'.json'),m);return m;});}

const lockGlobal=globalThis as typeof globalThis & {__nocodeDraftLocks?:Map<string,Promise<void>>};const locks=lockGlobal.__nocodeDraftLocks??=new Map<string,Promise<void>>();
export async function withDraftLock<T>(id:string,work:()=>Promise<T>){valid(id);const previous=locks.get(id)||Promise.resolve();let release!:()=>void;const next=new Promise<void>(resolve=>{release=resolve;});locks.set(id,next);await previous;try{return await work();}finally{release();if(locks.get(id)===next)locks.delete(id);}}
