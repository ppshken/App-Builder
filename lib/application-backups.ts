import {exportedColumnRows} from './shared-table-export';
import {tableOverlay} from './shared-table-columns';
import {externalTable,createExternalReadView} from './external-storage';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {initializeDatabase,columnDefinition,readColumns,foreignKeyTransaction} from './schema';
import {platformDatabase} from './db';
import {applicationScopeFor,assertManageApplication} from './applications';
import {APPLICATION_CONFIG_TABLES,applicationTable} from './application-context';
import {copyApplicationDatabase} from './application-lifecycle';
import {accountMapping,restoreAccountsSummary} from './restore-applications';
import {mediaReferences} from './media-inventory';
import {recordAppUsage} from './app-usage';
import {AuthError,type AuthUser} from './auth';
type Row=Record<string,any>;
function insert(db:Database.Database,table:string,row:Row){const keys=Object.keys(row);db.prepare('INSERT INTO "'+table+'"('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}
export function applicationBackupPlan(actor:AuthUser,id:string){
 const app=assertManageApplication(actor,id),db=platformDatabase(),scope=applicationScopeFor(actor,id);
 const tables=Object.entries(scope.datasets||{}).filter(([,r])=>r.read).map(([name,r])=>{if(!r.export)throw new AuthError('ต้องมีสิทธิ์ส่งออกทุกตารางก่อนสำรองแอป',403);const owner=(db.prepare('SELECT owner_app_id FROM _tables WHERE name=?').get(name) as Row).owner_app_id;return {name,rows:(db.prepare('SELECT COUNT(*) n FROM "t_'+name+'"').get() as Row).n,shared:owner!==id||!!db.prepare('SELECT 1 FROM _application_datasets WHERE table_name=? AND app_id<>? AND can_read=1').get(name,id)};});
 return {app,tables,restore_mode:'new-app' as const};
}
// A fresh database prevents deleted pages, other apps, sessions and passwords leaking into exports.
export function exportApplicationBackup(actor:AuthUser,id:string,path:string){
 const source=platformDatabase(),plan=applicationBackupPlan(actor,id),out=new Database(path);
 try{initializeDatabase(out,':memory:');out.pragma('application_id=1313030480');source.transaction(()=>foreignKeyTransaction(out,()=>{
  for(const t of plan.tables){const row=source.prepare('SELECT * FROM _tables WHERE name=?').get(t.name) as Row;insert(out,'_tables',{...row,label:tableOverlay(source,t.name,id)?.label||row.label,owner_app_id:'default',...(row.source_kind==='IMPORTED_DATA'&&row.owner_app_id!==id?{source_kind:'INTERNAL_DATABASE',source_id:null}:{})});}
  for(const t of plan.tables){for(const row of exportedColumnRows(source,t.name,id)){const {id:columnId,...column}=row;insert(out,'_columns',column);}for(const row of source.prepare('SELECT * FROM _auto_numbers WHERE table_name=?').all(t.name) as Row[])insert(out,'_auto_numbers',row);const cols=readColumns(source,t.name).filter(c=>!c.is_virtual);const connection=source.prepare('SELECT * FROM _external_sources WHERE table_name=? AND app_id=?').get(t.name,id) as Row|undefined;if(connection)insert(out,'_external_sources',{...connection,app_id:'default',enabled:0,next_sync_at:0});if(externalTable(source,t.name)){createExternalReadView(out,t.name,cols,connection!.id);continue;}out.exec('CREATE TABLE "t_'+t.name+'"(id INTEGER PRIMARY KEY AUTOINCREMENT'+(cols.length?',':'')+cols.map(columnDefinition).join(',')+')');for(const row of source.prepare('SELECT * FROM "t_'+t.name+'"').iterate() as Iterable<Row>)insert(out,'t_'+t.name,row);
   const seq=(source.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get('t_'+t.name) as Row|undefined)?.seq||0;if(!out.prepare('UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?').run(seq,'t_'+t.name).changes)out.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run('t_'+t.name,seq);
  }
  for(const logical of APPLICATION_CONFIG_TABLES){if(['_table_overlays','_automation_jobs','_app_versions','_user_setting_values','_role_actions'].includes(logical))continue;out.prepare('DELETE FROM "'+logical+'"').run();for(const row of source.prepare('SELECT * FROM "'+applicationTable(id,logical)+'"').all() as Row[])insert(out,logical,row);}
  out.prepare("UPDATE _applications SET label=?,description=? WHERE id='default'").run(plan.app.label,plan.app.description);
  const users=new Set<number>();for(const t of plan.tables){const sourceOwner=source.prepare('SELECT owner_id FROM _external_sources WHERE table_name=? AND app_id=?').get(t.name,id) as Row|undefined;if(sourceOwner)users.add(sourceOwner.owner_id);}for(const member of source.prepare('SELECT * FROM _application_members WHERE app_id=?').all(id) as Row[])users.add(member.user_id);
  for(const t of plan.tables)for(const c of readColumns(source,t.name).filter(c=>c.type==='user'&&!c.is_virtual))for(const row of source.prepare('SELECT DISTINCT "'+c.name+'" uid FROM "t_'+t.name+'" WHERE "'+c.name+'" IS NOT NULL').all() as Row[])users.add(row.uid);
  for(const uid of users){const row=source.prepare('SELECT * FROM _users WHERE id=?').get(uid) as Row|undefined;if(row)insert(out,'_users',{...row,password_hash:'',role:'owner',active:0});}
  // Local roles and memberships only; global Builder permissions are never imported.
  for(const logical of ['_application_local_roles','_application_role_tables','_application_role_actions','_application_role_rows'])for(const row of source.prepare('SELECT * FROM '+logical+' WHERE app_id=?').all(id) as Row[])insert(out,logical,{...row,app_id:'default'});
  for(const row of source.prepare('SELECT * FROM _application_members WHERE app_id=?').all(id) as Row[]){out.prepare("UPDATE _users SET role='backup_member' WHERE id=?").run(row.user_id);out.prepare("INSERT OR IGNORE INTO _roles VALUES('backup_member','Backup member',0)").run();insert(out,'_application_members',{...row,app_id:'default'});}
  out.prepare('INSERT OR REPLACE INTO _builder_security(id,separated) VALUES(1,1)').run();
  const refs=mediaReferences(source);for(const [key,links] of refs){if(!links.some(r=>r.app_id===id))continue;const [kind,mediaId]=key.split(':'),table=kind==='image'?'_images':'_files',row=source.prepare('SELECT * FROM '+table+' WHERE id=?').get(mediaId) as Row|undefined;if(!row)throw Error('ไม่พบไฟล์ที่ถูกอ้างอิง: '+mediaId);insert(out,table,kind==='image'?{...row,storage_path:''}:row);const meta=source.prepare('SELECT * FROM _media_catalog WHERE kind=? AND id=?').get(kind,mediaId) as Row|undefined;if(meta)insert(out,'_media_catalog',{...meta,app_id:'default',user_id:0,copy_path:'',published:1});}
 })).deferred();out.pragma('wal_checkpoint(TRUNCATE)');return plan;
 }finally{out.close();}
}
// The caller must pass the trusted ready.db rebuilt by inspectBackup, never uploaded SQL.
export function restoreApplicationBackup(actor:AuthUser,source:Database.Database,label:string){
 const db=platformDatabase(),apps=source.prepare('SELECT id FROM _applications').all() as {id:string}[];if(apps.length!==1||apps[0].id!=='default')throw Error('กรุณาเลือกไฟล์สำรองรายแอป ไม่ใช่ไฟล์สำรองทั้งระบบ');
 return db.transaction(()=>{
  const tables=(source.prepare('SELECT name FROM _tables ORDER BY name').all() as {name:string}[]).map(t=>t.name),accounts=accountMapping(source,db),summary=restoreAccountsSummary(source,db);
  for(const key of mediaReferences(source).keys()){const [kind,id]=key.split(':');if(!source.prepare('SELECT 1 FROM '+(kind==='image'?'_images':'_files')+' WHERE id=?').get(id))throw Error('ไฟล์สำรองมีข้อมูลไฟล์ไม่ครบ: '+id);}
  const mediaMap=new Map<string,string>();for(const [kind,table] of [['image','_images'],['file','_files']] as const)for(const row of source.prepare('SELECT * FROM '+table).all() as Row[]){const id=randomUUID();mediaMap.set('/api/'+(kind==='image'?'images':'files')+'/'+row.id,'/api/'+(kind==='image'?'images':'files')+'/'+id);insert(db,table,{...row,id,...(kind==='image'?{storage_path:''}:{})});}
  const app=copyApplicationDatabase(actor,source,'default',label,(source.prepare("SELECT description FROM _applications WHERE id='default'").get() as Row).description,tables);
  const rewrite=(value:unknown)=>typeof value==='string'?value.replace(/\/api\/(?:images|files)\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,url=>mediaMap.get(url)||url):value;
  for(const [old,name] of Object.entries(app.table_mapping)){const cols=readColumns(db,name).filter(c=>!c.is_virtual);let after=0;while(true){const batch=db.prepare('SELECT * FROM "t_'+name+'" WHERE id>? ORDER BY id LIMIT 500').all(after) as Row[];if(!batch.length)break;for(const row of batch){after=row.id;const values=cols.map(c=>c.type==='user'?(accounts.get(row[c.name])??null):rewrite(row[c.name]));if(cols.length)db.prepare('UPDATE "t_'+name+'" SET '+cols.map(c=>'"'+c.name+'"=?').join(',')+' WHERE id=?').run(...values,row.id);}}}
  for(const name of Object.values(app.table_mapping))for(const row of db.prepare('SELECT * FROM _columns WHERE table_name=?').all(name) as Row[]){const keys=Object.keys(row).filter(k=>typeof row[k]==='string');if(keys.length)db.prepare('UPDATE _columns SET '+keys.map(k=>'"'+k+'"=?').join(',')+' WHERE id=?').run(...keys.map(k=>rewrite(row[k])),row.id);}
  for(const logical of APPLICATION_CONFIG_TABLES.filter(t=>!['_automation_jobs','_app_versions','_user_setting_values'].includes(t))){const table=applicationTable(app.id,logical);for(const row of db.prepare('SELECT rowid restore_rowid,* FROM "'+table+'"').all() as Row[]){const keys=Object.keys(row).filter(k=>k!=='restore_rowid'&&typeof row[k]==='string');if(keys.length)db.prepare('UPDATE "'+table+'" SET '+keys.map(k=>'"'+k+'"=?').join(',')+' WHERE rowid=?').run(...keys.map(k=>rewrite(row[k])),row.restore_rowid);}}
  for(const row of source.prepare("SELECT * FROM _application_members WHERE app_id='default'").all() as Row[]){const uid=accounts.get(row.user_id);if(uid&&!db.prepare("SELECT 1 FROM _users WHERE id=? AND role='owner'").get(uid))insert(db,'_application_members',{...row,app_id:app.id,user_id:uid});}
  for(const [original,url] of mediaMap){const kind=url.includes('/images/')?'image':'file',meta=source.prepare('SELECT folder,original_name FROM _media_catalog WHERE kind=? AND id=?').get(kind,original.split('/').pop()) as Row|undefined;insert(db,'_media_catalog',{kind,id:url.split('/').pop(),app_id:app.id,user_id:actor.id,created_at:Date.now(),folder:meta?.folder||'',original_name:meta?.original_name||'',copy_path:'',published:1});}
  recordAppUsage(db,actor,app.id,'restore','application',201);if((db.pragma('foreign_key_check') as unknown[]).length)throw Error('ข้อมูลอ้างอิงไม่ถูกต้อง ยกเลิกการกู้คืนแล้ว');return {app,accounts:summary};
 }).immediate();
}
