import {validateCustomData} from './custom-page-references';
import {VIEW_KINDS,VIEW_POSITIONS} from "./views";
import {applicationIds,createApplicationConfig} from './application-schema';
import {applicationDatabase} from './db';
import {applicationTable} from './application-context';
import {securitySeparated,ensureBuilderAccountRole} from './builder-security';
import {RESTORED_SECURITY,restoreConfigTables,restoreApplications,validateRestoreSecurity,trustedRestoreObjects,normalizeRestoreSecurity,remapRestoredAccounts,restoreAccountsSummary,type RestoreAccountSummary} from './restore-applications';
import {realtimeTriggerDefinitions,installRealtimeTriggers} from "./realtime-schema";
import {validateStoredWorkflows} from "./workflow-validation";
import {auditTriggerDefinitions,installAuditing,removeAuditTriggers} from "./audit-schema";
import {auditContext,withoutAudit} from "./audit-context";
import {assertPartSchema} from "./part-of-config";
import {validateSpecialView} from "./special-view-config";
import {actionConfigExpressions,ACTION_KINDS,appearance} from "./action-config";
import {AUTH_TABLES} from "./auth-schema";
import Database from "better-sqlite3";
import {mkdirSync,readdirSync,lstatSync,openSync,readSync,closeSync,unlinkSync,rmdirSync,existsSync} from "node:fs";
import {dirname,join,resolve,basename} from "node:path";
import {randomUUID} from "node:crypto";
import {initializeDatabase,readColumns,columnDefinition,syncKeyIndex,foreignKeyTransaction,createDefaultViews,createInlineViews} from "./schema";
import {assertIdentifier,assertFormulas,Column} from "./columns";
import {DEFAULT_SETTINGS,validateSettings} from "./app-settings";
import {validateDisplay} from "./view-display";
import {migrateListReferences,assertStoredListReferences} from "./list-reference-migration";

const META = ["_applications","_application_datasets","_application_roles","_realtime_versions","_tables","_columns","_auto_numbers","_views","_slices","_actions","_app_settings","_images","_files","_audit_log","_pdf_templates","_automations","_automation_jobs","_app_versions"];
const FILE_NAME=/^data\.(?:before|backup)-[a-z0-9TZ.-]+\.db$/;
export const MAX_BACKUP_BYTES=512*1024*1024;
export type BackupInfo={name:string;size:number;created:string;reason:string};
export function backupFolder(path:string){const folder=join(dirname(resolve(path)),"backups");mkdirSync(folder,{recursive:true});if(lstatSync(folder).isSymbolicLink())throw Error("โฟลเดอร์สำรองต้องเป็นโฟลเดอร์จริง ไม่ใช่ทางลัด");return folder;}
export function backupFile(path:string,name:string){if(typeof name!=="string"||!FILE_NAME.test(name)||basename(name)!==name)throw Error("ชื่อไฟล์สำรองไม่ถูกต้อง");const file=join(backupFolder(path),name);if(!existsSync(file)||!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw Error("ไม่พบไฟล์สำรองนี้ กรุณาโหลดรายการใหม่");return file;}
function info(file:string):BackupInfo {const stat=lstatSync(file),name=basename(file);return {name,size:stat.size,created:stat.mtime.toISOString(),reason:name.startsWith("data.backup-manual-")?"สำรองด้วยตนเอง":name.startsWith("data.backup-restore-")?"ก่อนกู้คืนข้อมูล":name.startsWith("data.backup-schema-")?"ก่อนแก้โครงสร้างตาราง":"ก่อนอัปเดตระบบ"};}
export function listBackups(path:string){const folder=backupFolder(path);return readdirSync(folder,{withFileTypes:true}).filter(f=>f.isFile()&&FILE_NAME.test(f.name)).map(f=>info(join(folder,f.name))).sort((a,b)=>b.created.localeCompare(a.created));}
export function createBackup(db:Database.Database,path:string,reason:"manual"|"schema"|"restore"="manual"){const name=`data.backup-${reason}-${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID()}.db`,file=join(backupFolder(path),name);try{db.prepare("VACUUM INTO ?").run(file);return info(file);}catch(e){if(existsSync(file))unlinkSync(file);throw e;}}
export type RestoreSummary={tables:{name:string;label:string;rows:number}[];rows:number;images:number;files:number;views:number;appName:string;apps:{id:string;label:string;views:number}[];roles:number;accounts?:RestoreAccountSummary};
type SchemaObject={name:string;type:string;sql:string|null;tbl_name:string};
function objects(db:Database.Database){return db.prepare("SELECT name,type,sql,tbl_name FROM sqlite_master").all() as SchemaObject[];}
function supportedTables(db:Database.Database) {
 const all=objects(db);
 const appConfigs=restoreConfigTables(db);if(appConfigs.some(name=>!all.some(o=>o.name===name&&o.type==='table')))throw Error("โครงสร้างการตั้งค่ารายแอปในไฟล์สำรองไม่ครบ");
 const realtimeTables=db.prepare("SELECT name FROM _tables").all() as {name:string}[];
 const trustedTriggers=new Map([...auditTriggerDefinitions(db),...realtimeTables.flatMap(t=>realtimeTriggerDefinitions(t.name))].map(t=>[t.name,t.sql]));
 if(all.some(o=>o.type==="view"||o.type==="trigger"&&o.sql?.trim()!==trustedTriggers.get(o.name)))throw Error("ไฟล์นี้มี SQL View หรือ Trigger ที่ระบบกู้คืนยังไม่รองรับ กรุณาใช้ไฟล์สำรองของ No-code Builder");
 if(!["_tables","_columns"].every(name=>all.some(o=>o.name===name&&o.type==="table")))throw Error("ไฟล์นี้ไม่ใช่ฐานข้อมูลของ No-code Builder");
 const tables=db.prepare("SELECT name,label FROM _tables ORDER BY name").all() as {name:string;label:string}[];
 if(tables.length>2000)throw Error("ไฟล์สำรองมีตารางมากเกินกว่าระบบกู้คืนรองรับ");
 for(const t of tables){assertIdentifier(t.name);if(typeof t.label!=="string")throw Error("ชื่อตารางในไฟล์สำรองไม่ถูกต้อง");}
 const names=new Set([...META,...AUTH_TABLES,...appConfigs,"_app_usage","_media_catalog","sqlite_sequence",...tables.map(t=>`t_${t.name}`)]);
 if(all.some(o=>o.type==="table"&&!names.has(o.name)))throw Error("ไฟล์นี้มีตารางนอกระบบที่ยังไม่รองรับการกู้คืน กรุณาใช้ไฟล์สำรองของ No-code Builder");
 return tables;
}
// Rebuild into a fresh, trusted schema. Never execute SQL definitions from an uploaded file.
export function inspectBackup(sourceFile:string,stageFile:string,current?:Database.Database,applicationPackage=false):RestoreSummary {
 const size=lstatSync(sourceFile).size;if(size<100||size>MAX_BACKUP_BYTES)throw Error("ไฟล์สำรองต้องเป็น SQLite และมีขนาดไม่เกิน 512 MB");
 const fd=openSync(sourceFile,"r"),header=Buffer.alloc(16);try{readSync(fd,header,0,16,0);}finally{closeSync(fd);}if(header.toString("ascii")!=="SQLite format 3\0")throw Error("ไฟล์นี้ไม่ใช่ SQLite กรุณาเลือกไฟล์ .db ที่สำรองไว้");
 const source=new Database(sourceFile,{readonly:true,fileMustExist:true});let stage:Database.Database|undefined;
 try {
  source.pragma("trusted_schema = OFF");
  const scoped=source.pragma("application_id",{simple:true})===1313030480;if(scoped!==applicationPackage)throw Error(scoped?"ไฟล์นี้เป็นสำรองรายแอป กรุณาใช้แท็บสำรองแยกแอป":"กรุณาเลือกไฟล์สำรองรายแอป");
  if(source.pragma("integrity_check",{simple:true})!=="ok")throw Error("ไฟล์สำรองเสียหาย กรุณาเลือกไฟล์อื่น");
  const tables=supportedTables(source),all=objects(source),has=(name:string)=>all.some(o=>o.name===name&&o.type==="table");
  const schemas:Record<string,Column[]>={};for(const t of tables){const cols=readColumns(source,t.name);if(!cols.length||cols.length>200)throw Error(`คอลัมน์ของตาราง "${t.label}" ไม่ถูกต้อง`);schemas[t.name]=cols;}
  assertPartSchema(schemas);for(const t of tables){const cols=schemas[t.name];assertFormulas(cols,schemas);for(const c of cols)if(c.ref_table&&!schemas[c.ref_table])throw Error(`ไม่พบตารางอ้างอิงของ "${c.label}" ในไฟล์สำรอง`);}
  if(existsSync(stageFile))throw Error("พื้นที่เตรียมกู้คืนมีไฟล์อยู่แล้ว กรุณาตรวจไฟล์ใหม่");
  stage=new Database(stageFile);initializeDatabase(stage,":memory:");
  const destination=stage;
  const copyMeta=(name:string)=>{
   if(!has(name))return;
   const target=destination.pragma(`table_info('${name}')`) as {name:string}[],fields=target.map(c=>c.name),sourceFields=(source.pragma(`table_info('${name}')`) as {name:string}[]).map(c=>c.name);
   if(sourceFields.some(n=>!fields.includes(n)))throw Error("ไฟล์สำรองสร้างจากเวอร์ชันที่ใหม่กว่านี้ กรุณาอัปเดตระบบก่อนกู้คืน");
   destination.prepare(`DELETE FROM "${name}"`).run();
   const selected=fields.filter(n=>sourceFields.includes(n)),quoted=selected.map(n=>`"${n}"`).join(","),insert=destination.prepare(`INSERT INTO "${name}"(${quoted}) VALUES(${selected.map(()=>"?").join(",")})`);
   for(const row of source.prepare(`SELECT * FROM "${name}"`).iterate() as Iterable<Record<string,any>>)insert.run(...selected.map(n=>row[n]));
  };
  foreignKeyTransaction(destination,()=>{
   for(const name of META)copyMeta(name);
   for(const id of restoreApplications(destination))createApplicationConfig(destination,id);
   for(const name of restoreConfigTables(destination))copyMeta(name);
   for(const name of AUTH_TABLES.filter(n=>!['_sessions','_auth_attempts'].includes(n)))copyMeta(name);
   for(const t of tables){
    const cols=schemas[t.name].filter(c=>!c.is_virtual),fields=["id",...cols.map(c=>c.name)],physical=(source.pragma(`table_info('t_${t.name}')`) as {name:string;pk:number;type:string}[]);
    if(!physical.some(c=>c.name==="id"&&c.pk===1&&c.type.toUpperCase()==="INTEGER")||physical.length!==fields.length||physical.some(c=>!fields.includes(c.name)))throw Error(`โครงสร้างข้อมูลของ "${t.label}" ไม่ตรงกับคอลัมน์ในไฟล์สำรอง`);
    destination.prepare(`CREATE TABLE "t_${t.name}"(id INTEGER PRIMARY KEY AUTOINCREMENT${cols.length?",":""}${cols.map(columnDefinition).join(",")})`).run();
    const quoted=fields.map(n=>`"${n}"`).join(","),insert=destination.prepare(`INSERT INTO "t_${t.name}"(${quoted}) VALUES(${fields.map(()=>"?").join(",")})`);
    for(const row of source.prepare(`SELECT ${quoted} FROM "t_${t.name}"`).iterate() as Iterable<Record<string,any>>){if(!Number.isSafeInteger(row.id)||row.id<1)throw Error(`รหัสแถวของ "${t.label}" ไม่ถูกต้อง`);insert.run(...fields.map(n=>row[n]));}
    const key=cols.find(c=>c.is_key);if(key&&destination.prepare(`SELECT 1 FROM "t_${t.name}" WHERE "${key.name}" IS NULL OR TRIM(CAST("${key.name}" AS TEXT))='' LIMIT 1`).get())throw Error(`Key "${key.label}" มีข้อมูลว่างในไฟล์สำรอง`);
    syncKeyIndex(destination,t.name);
   }
   if(has("sqlite_sequence"))for(const seq of source.prepare("SELECT name,seq FROM sqlite_sequence").all() as {name:string;seq:number}[]){if(seq.name==="_columns"||tables.some(t=>`t_${t.name}`===seq.name)){if(!Number.isSafeInteger(seq.seq)||seq.seq<0)throw Error("เลขลำดับข้อมูลในไฟล์สำรองไม่ถูกต้อง");const current=destination.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(seq.name) as {seq:number}|undefined;if(current)destination.prepare("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?").run(seq.seq,seq.name);else destination.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)").run(seq.name,seq.seq);}}
   migrateListReferences(destination);
   assertStoredListReferences(destination);
   if(!has("_views"))for(const t of tables)createDefaultViews(destination,t.name,t.label);
   else if(!(source.pragma("table_info('_views')") as {name:string}[]).some(c=>c.name==="inline_ref"))for(const t of tables)createInlineViews(destination,t.name);
   for(const appId of restoreApplications(destination)){const configured=applicationDatabase(destination,appId);
   for(const slice of configured.prepare('SELECT * FROM _slices').all() as any[]){assertIdentifier(slice.name);if(!schemas[slice.table_name])throw Error('Slice อ้างอิงตารางที่ไม่มี');const columns=JSON.parse(slice.columns_json);if(!Array.isArray(columns)||columns.some(name=>!schemas[slice.table_name].some(c=>c.name===name)))throw Error('คอลัมน์ของ Slice ในไฟล์สำรองไม่ถูกต้อง');assertFormulas([...schemas[slice.table_name],{name:'slice_check',label:'Slice',type:'text',show_if:slice.filter_expr}],schemas);}
   for(const view of configured.prepare('SELECT * FROM _views').all() as any[]){assertIdentifier(view.name);if(!VIEW_KINDS.some(([kind])=>kind===view.kind)||!VIEW_POSITIONS.some(([position])=>position===view.position))throw Error('รูปแบบ View ในไฟล์สำรองไม่ถูกต้อง');if(view.slice_name&&!configured.prepare('SELECT 1 FROM _slices WHERE name=? AND table_name=?').get(view.slice_name,view.table_name))throw Error('View อ้างอิง Slice ที่ไม่ตรงกับตาราง');if(view.show_if)assertFormulas([...(schemas[view.table_name]||[]),{name:'view_check',label:'View',type:'text',show_if:view.show_if}],schemas);if(view.position==='inline'&&!schemas[view.table_name]?.some(c=>c.name===view.inline_ref&&c.type==='ref'&&!c.is_virtual))throw Error('Inline View อ้างอิงคอลัมน์ Ref ไม่ถูกต้อง');}

   for(const v of configured.prepare("SELECT kind,table_name,columns_json,display_json FROM _views").all() as {kind:string;table_name:string;columns_json:string;display_json:string}[]){if(!["dashboard","custom"].includes(v.kind)&&!schemas[v.table_name])throw Error("View อ้างอิงตารางที่ไม่มีในไฟล์สำรอง");const names=JSON.parse(v.columns_json);if(!Array.isArray(names)||names.some(n=>!(["dashboard","custom"].includes(v.kind)?[]:schemas[v.table_name]).some(c=>c.name===n)))throw Error("คอลัมน์ของ View ในไฟล์สำรองไม่ถูกต้อง");validateDisplay(JSON.parse(v.display_json),["dashboard","custom"].includes(v.kind)?[]:schemas[v.table_name]);}
   const viewRegistry=configured.prepare("SELECT name,kind,position,table_name,display_json FROM _views").all() as any[];for(const v of viewRegistry){const display=JSON.parse(v.display_json);validateSpecialView(v.kind,display,viewRegistry,v.name);if(v.kind==='custom')validateCustomData(display.custom_page,configured.prepare("SELECT name,table_name FROM _views").all() as any[],configured.prepare("SELECT name FROM _actions").all() as any[],schemas);}
   for(const a of configured.prepare("SELECT * FROM _actions").all() as any[]){if(!Object.hasOwn(ACTION_KINDS,a.kind)||!schemas[a.table_name])throw Error("Action ในไฟล์สำรองไม่ถูกต้อง");appearance(JSON.parse(a.appearance_json||"{}"),a.kind);const config=JSON.parse(a.config_json||"{}"),values=JSON.parse(a.values_json||"{}");if(!values||typeof values!=="object"||Array.isArray(values))throw Error("สูตรค่าของ Action ในไฟล์สำรองไม่ถูกต้อง");for(const [name,formula] of Object.entries(values)){if(!schemas[a.table_name].some(c=>c.name===name&&!c.is_virtual))throw Error("Action อ้างอิงคอลัมน์ที่ไม่มีในไฟล์สำรอง");assertFormulas([...schemas[a.table_name],{name:"action_check",label:"Action",type:"text",show_if:formula as string}],schemas);}assertFormulas([...schemas[a.table_name],{name:"action_check",label:"Action",type:"text",show_if:a.condition_expr}],schemas);if(["open_url","call","sms","email"].includes(a.kind)){if(typeof config.url_expr!=="string"||!config.url_expr.trim())throw Error("Action ลิงก์ในไฟล์สำรองไม่มีสูตร");assertFormulas([...schemas[a.table_name],{name:"action_check",label:"Action",type:"text",show_if:config.url_expr}],schemas);}if(["open_view","edit_form","new_form","open_detail"].includes(a.kind)&&!configured.prepare("SELECT 1 FROM _views WHERE name=? AND position<>'inline'").get(config.view_name))throw Error("Action ในไฟล์สำรองเปิด View ที่ไม่มีอยู่");for(const formula of actionConfigExpressions(config))assertFormulas([...schemas[a.table_name],{name:"action_check",label:"Action",type:"text",show_if:formula}],schemas);if(a.kind==="new_form"){const target=configured.prepare("SELECT table_name FROM _views WHERE name=?").get(config.view_name) as any;for(const name of Object.keys(config.initial_values||{}))if(!schemas[target?.table_name]?.some(c=>c.name===name&&!c.is_virtual))throw Error("ค่าตั้งต้นฟอร์มอ้างอิงคอลัมน์ปลายทางที่ไม่มีอยู่");}if(a.kind==="grouped"){if(!Array.isArray(config.actions)||!config.actions.length||config.actions.length>10||new Set(config.actions).size!==config.actions.length)throw Error("ชุด Action ในไฟล์สำรองไม่ถูกต้อง");for(let i=0;i<config.actions.length;i++){const child=configured.prepare("SELECT * FROM _actions WHERE name=?").get(config.actions[i]) as any;if(!child||child.table_name!==a.table_name||!["set","copy","add","delete"].includes(child.kind)||child.kind==="delete"&&i!==config.actions.length-1)throw Error("ขั้นตอนในชุด Action ไม่ถูกต้อง");}}}
   validateStoredWorkflows(configured);
   const raw=configured.prepare("SELECT * FROM _app_settings WHERE id=1").get() as any;if(!raw)throw Error("ไม่พบการตั้งค่าแอพในไฟล์สำรอง");if(raw.list_reference_version!==1)throw Error("รุ่นรหัสอ้างอิงของแอปในไฟล์สำรองยังไม่รองรับ");if(![0,1].includes(raw.image_allow_gallery))throw Error("การตั้งค่า Gallery ในไฟล์สำรองไม่ถูกต้อง");validateSettings({...raw,image_allow_gallery:raw.image_allow_gallery===1,header:JSON.parse(raw.header_json),navigation:JSON.parse(raw.navigation_json),display_defaults:JSON.parse(raw.display_defaults_json)},DEFAULT_SETTINGS);
   }
   validateRestoreSecurity(destination);
   normalizeRestoreSecurity(destination,!!current&&(securitySeparated(current)||!!current.prepare("SELECT 1 FROM _users LIMIT 1").get()));

  });
  if(destination.pragma("integrity_check",{simple:true})!=="ok")throw Error("ตรวจข้อมูลหลังเตรียมกู้คืนไม่ผ่าน กรุณาเลือกไฟล์สำรองอื่น");
  const resultTables=tables.map(t=>({...t,rows:(destination.prepare(`SELECT COUNT(*) AS n FROM "t_${t.name}"`).get() as {n:number}).n}));
  const apps=restoreApplications(destination).map(id=>({id,label:(destination.prepare('SELECT name FROM "'+applicationTable(id,'_app_settings')+'" WHERE id=1').get() as {name:string}).name,views:(destination.prepare('SELECT COUNT(*) AS n FROM "'+applicationTable(id,'_views')+'"').get() as {n:number}).n}));
  return {tables:resultTables,rows:resultTables.reduce((n,t)=>n+t.rows,0),files:(destination.prepare("SELECT COUNT(*) AS n FROM _files").get() as {n:number}).n,images:(destination.prepare("SELECT COUNT(*) AS n FROM _images").get() as {n:number}).n,views:apps.reduce((n,a)=>n+a.views,0),appName:apps[0].label,apps,roles:(destination.prepare('SELECT COUNT(*) AS n FROM _application_local_roles').get() as {n:number}).n,...(current?{accounts:restoreAccountsSummary(destination,current)}:{})};
 }catch(e){if(e instanceof Error && /[ก-๙]/.test(e.message))throw e;throw Error("ไฟล์สำรองเสียหายหรือโครงสร้างไม่รองรับ กรุณาเลือกไฟล์สำรองของ No-code Builder",{cause:e});}finally{stage?.close();source.close();}
}
// Replace logical contents inside one SQLite transaction; keep the live file/connection intact.
export function restoreBackup(db:Database.Database,path:string,stageFile:string){
 const stage=new Database(stageFile,{readonly:true,fileMustExist:true});try{
  supportedTables(db);const tables=supportedTables(stage),schema=trustedRestoreObjects(stage),config=restoreConfigTables(stage),replaced=new Set([...META,...RESTORED_SECURITY,'_user_setting_defs','_user_setting_values',...config,...tables.map(t=>'t_'+t.name)]);
  const preserved=(name:string)=>AUTH_TABLES.includes(name)&&!RESTORED_SECURITY.includes(name)&&!['_user_setting_defs','_user_setting_values'].includes(name)||['_audit_log','_app_usage','_media_catalog'].includes(name);
  stage.pragma('trusted_schema=OFF');if((stage.pragma('foreign_key_check') as unknown[]).length)throw Error('ไฟล์เตรียมกู้คืนมีข้อมูลอ้างอิงไม่ครบ');
  const preferences=new Map(restoreApplications(db).map(id=>[id,db.prepare('SELECT user_id,name,value_json FROM "'+applicationTable(id,'_user_setting_values')+'"').all() as {user_id:number;name:string;value_json:string}[]]));
  const restoreAudit=auditContext(),before=createBackup(db,path,"restore");
  db.prepare("ATTACH DATABASE ? AS restore_snapshot").run(stageFile);
  try{withoutAudit(()=>foreignKeyTransaction(db,()=>{
   removeAuditTriggers(db);
   const keepSeparated=securitySeparated(db)||!!db.prepare("SELECT 1 FROM _users LIMIT 1").get();
   for(const obj of objects(db).filter(o=>o.type==='table'&&o.name!=='sqlite_sequence'&&!preserved(o.name)))db.prepare('DROP TABLE "'+obj.name+'"').run();
   for(const obj of schema.filter(o=>o.type==='table'&&o.name!=='sqlite_sequence'&&!preserved(o.name))){if(!replaced.has(obj.name))throw Error('โครงสร้างไฟล์ที่เตรียมกู้คืนไม่ถูกต้อง');db.exec(obj.sql!);const cols=(stage.pragma('table_info("'+obj.name+'")') as {name:string}[]).map(c=>'"'+c.name+'"').join(',');db.prepare('INSERT INTO main."'+obj.name+'"('+cols+') SELECT '+cols+' FROM restore_snapshot."'+obj.name+'"').run();}
   if(keepSeparated)db.prepare('INSERT INTO _builder_security(id,separated) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET separated=1').run();
   // Restore role definitions but map assignments and user preferences to current
   // accounts by email. Neither source passwords nor platform roles are installed.
   remapRestoredAccounts(db,stage,preferences);
   if(securitySeparated(db))ensureBuilderAccountRole(db);
   db.prepare("DELETE FROM main.sqlite_sequence WHERE name NOT IN (SELECT name FROM sqlite_master WHERE type='table')").run();
   for(const seq of stage.prepare('SELECT name,seq FROM sqlite_sequence').all() as {name:string;seq:number}[])if(replaced.has(seq.name)){if(!Number.isSafeInteger(seq.seq)||seq.seq<0)throw Error('เลขลำดับข้อมูลในไฟล์สำรองไม่ถูกต้อง');const current=db.prepare('SELECT seq FROM main.sqlite_sequence WHERE name=?').get(seq.name) as {seq:number}|undefined;if(current)db.prepare('UPDATE main.sqlite_sequence SET seq=MAX(seq,?) WHERE name=?').run(seq.seq,seq.name);else db.prepare('INSERT INTO main.sqlite_sequence(name,seq) VALUES(?,?)').run(seq.name,seq.seq);}
   db.prepare('DELETE FROM _sessions').run();
   db.prepare('DELETE FROM _role_row_rules WHERE table_name NOT IN (SELECT name FROM _tables)').run();
   db.prepare('DELETE FROM _role_tables WHERE table_name NOT IN (SELECT name FROM _tables)').run();
   db.prepare('DELETE FROM _role_actions WHERE action_name NOT IN (SELECT name FROM _actions)').run();
   db.prepare('DELETE FROM _file_uploads WHERE file_id NOT IN (SELECT id FROM _files)').run();
   db.prepare('DELETE FROM _image_uploads WHERE image_id NOT IN (SELECT id FROM _images)').run();
   db.prepare("UPDATE _user_profiles SET avatar='' WHERE avatar LIKE '/api/images/%' AND SUBSTR(avatar,13) NOT IN (SELECT id FROM _images)").run();
   const fields=(db.pragma("table_info('_audit_log')") as {name:string}[]).map(c=>'"'+c.name+'"').join(',');db.prepare('INSERT OR IGNORE INTO main._audit_log('+fields+') SELECT '+fields+' FROM restore_snapshot._audit_log').run();
   for(const obj of schema.filter(o=>o.type==='index'&&o.sql&&!preserved(o.tbl_name)))db.exec(obj.sql!);
   for(const t of tables){syncKeyIndex(db,t.name);installRealtimeTriggers(db,t.name);}
   installAuditing(db);
   if(restoreAudit){const actor=restoreAudit.actor;db.prepare('INSERT INTO _audit_log(event_id,request_id,occurred_at,actor_id,actor_name,actor_email,actor_role,category,entity_type,entity_key,entity_label,operation,source,changes_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),restoreAudit.requestId,Date.now(),actor.id,actor.name,actor.email,actor.role,'settings','_restore',before.name,'กู้คืนข้อมูลทุกแอป','update',restoreAudit.source,JSON.stringify([{path:['applications'],before:null,after:restoreApplications(db),before_exists:false,after_exists:true}]));}
  }));}finally{db.prepare("DETACH DATABASE restore_snapshot").run();}
  return before;
 }finally{stage.close();}
}
export function cleanStage(folder:string){const absolute=resolve(folder);if(!/^\.restore-stage-[a-f0-9-]{36}$/.test(basename(absolute))||!existsSync(absolute)||lstatSync(absolute).isSymbolicLink())return;for(const name of ["upload.db","ready.db","ready.db-wal","ready.db-shm"]){const file=join(absolute,name);if(existsSync(file)&&!lstatSync(file).isDirectory())unlinkSync(file);}if(readdirSync(absolute).length===0)rmdirSync(absolute);}
