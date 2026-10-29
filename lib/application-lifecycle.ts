import type Database from 'better-sqlite3';
import {platformDatabase} from './db';
import {applications,applicationScopeFor,createApplication,assertManageApplication} from './applications';
import {APPLICATION_CONFIG_TABLES,applicationTable} from './application-context';
import {AuthError,type AuthUser} from './auth';
import {securitySeparated} from './builder-security';
import {columnDefinition,readColumns,syncKeyIndex} from './schema';
import {installRealtimeTriggers} from './realtime-schema';
import {installAuditing} from './audit-schema';
import {remapApplicationConfig} from './application-clone-config';
import {remapExpressionTables} from './expression';
import {assertFormulas,type Column} from './columns';
type Row=Record<string,any>;
const quote=(name:string)=>'"'+name+'"';
function insert(db:Database.Database,table:string,row:Row){const keys=Object.keys(row);db.prepare('INSERT INTO '+quote(table)+'('+keys.map(quote).join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}
export function transformApplicationRow(row:Row,mapping:Record<string,string>,logical:string){return Object.fromEntries(Object.entries(row).map(([key,value])=>{if(typeof value!=='string')return [key,value];if((key.endsWith('_json')||key==='options')&&value.trim()&&/^[\[{]/.test(value.trim())){let json;try{json=JSON.parse(value);}catch(e){if(key==='options')return [key,value];throw e;}return [key,JSON.stringify(remapApplicationConfig(json,mapping,key==='values_json'?'values':key))];}return [key,remapApplicationConfig(value,mapping,key)];}));}
export function cloneApplication(actor:AuthUser,sourceId:unknown,label:unknown,mode:unknown,includeData=false){
 const source=assertManageApplication(actor,sourceId);if(!['shared','new'].includes(String(mode))||typeof includeData!=='boolean')throw new AuthError('เลือกรูปแบบฐานข้อมูลให้ถูกต้อง');
 const db=platformDatabase(),scope=applicationScopeFor(actor,source.id),tables=Object.entries(scope.datasets||{}).filter(([,rights])=>rights.read).map(([name])=>name);
 if(mode==='new'&&includeData&&tables.some(t=>!scope.datasets![t].export))throw new AuthError('ต้องมีสิทธิ์ส่งออกทุกตารางก่อนคัดลอกข้อมูลเดิม',403);
 return copyApplicationDatabase(actor,db,source.id,label,source.description,tables,mode,includeData,scope.datasets!);
}
// Source must be a validated, isolated backup database when it differs from the target.
export function copyApplicationDatabase(actor:AuthUser,sourceDb:Database.Database,sourceId:string,label:unknown,description:string,tables:string[],mode:unknown='new',includeData=true,rights:Record<string,any>={}){
 const db=platformDatabase();
 return db.transaction(()=>{
  db.pragma('defer_foreign_keys=ON');const target=createApplication(label,description),mapping:Record<string,string>={};
  if(mode==='new')for(const [i,name] of tables.entries())mapping[name]='c_'+target.id.slice(2,10)+'_'+i+'_'+name.slice(0,24);
  if(mode==='new'){
   for(const name of tables){const original=sourceDb.prepare('SELECT * FROM _tables WHERE name=?').get(name) as Row;insert(db,'_tables',{...original,name:mapping[name],owner_app_id:target.id});}
   for(const name of tables)for(const original of sourceDb.prepare('SELECT * FROM _columns WHERE table_name=? ORDER BY pos,id').all(name) as Row[]){if(original.ref_table&&!mapping[original.ref_table])throw new AuthError('ตารางอ้างอิง '+original.ref_table+' ยังไม่ได้เชื่อมกับแอพต้นฉบับ');const {id,...column}=original;insert(db,'_columns',transformApplicationRow({...column,table_name:mapping[name]},mapping,'_columns'));}
   if(includeData)for(const name of tables)for(const row of sourceDb.prepare('SELECT * FROM _auto_numbers WHERE table_name=?').all(name) as Row[])insert(db,'_auto_numbers',{...row,table_name:mapping[name]});
   for(const name of tables){const cols=readColumns(db,mapping[name]).filter(c=>!c.is_virtual);db.exec('CREATE TABLE '+quote('t_'+mapping[name])+'(id INTEGER PRIMARY KEY AUTOINCREMENT'+(cols.length?',':'')+cols.map(columnDefinition).join(',')+')');}
   for(const name of tables){if(includeData){const fields=['id',...readColumns(db,mapping[name]).filter(c=>!c.is_virtual).map(c=>c.name)].map(quote).join(',');if(sourceDb===db)db.exec('INSERT INTO '+quote('t_'+mapping[name])+'('+fields+') SELECT '+fields+' FROM '+quote('t_'+name));else{const write=db.prepare('INSERT INTO '+quote('t_'+mapping[name])+'('+fields+') VALUES('+fields.split(',').map(()=>'?').join(',')+')');for(const row of sourceDb.prepare('SELECT '+fields+' FROM '+quote('t_'+name)).iterate() as Iterable<Row>)write.run(...Object.values(row));}const seq=(sourceDb.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get('t_'+name) as {seq:number}|undefined)?.seq||0;const result=db.prepare('UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?').run(seq,'t_'+mapping[name]);if(!result.changes)db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run('t_'+mapping[name],seq);}syncKeyIndex(db,mapping[name]);installRealtimeTriggers(db,mapping[name]);}
   const schemas:Record<string,Column[]>=Object.fromEntries(Object.values(mapping).map(name=>[name,readColumns(db,name)]));for(const cols of Object.values(schemas))assertFormulas(cols,schemas);
  }else for(const name of tables){const grant=rights[name];insert(db,'_application_datasets',{app_id:target.id,table_name:name,can_read:1,can_create:Number(grant.create),can_update:Number(grant.update),can_delete:Number(grant.delete),can_export:Number(grant.export)});}
  const skip=new Set(['_automation_jobs','_app_versions','_user_setting_values']);
  for(const logical of APPLICATION_CONFIG_TABLES){if(skip.has(logical))continue;const table=applicationTable(target.id,logical);db.prepare('DELETE FROM '+quote(table)).run();for(const original of sourceDb.prepare('SELECT * FROM '+quote(applicationTable(sourceId,logical))).all() as Row[]){let row=transformApplicationRow(original,mapping,logical);if(logical==='_app_settings')row.name=String(label).trim();if(logical==='_automations'){row.enabled=0;row.owner_id=actor.id;row.next_run_at=0;const config=JSON.parse(row.config_json);config.enabled=false;row.config_json=JSON.stringify(config);}insert(db,table,row);}}
  for(const logical of ['_application_local_roles','_application_role_tables','_application_role_actions','_application_role_rows'])for(const original of sourceDb.prepare('SELECT * FROM '+quote(logical)+' WHERE app_id=?').all(sourceId) as Row[]){const row=transformApplicationRow({...original,app_id:target.id},mapping,logical);if(logical==='_application_role_rows')row.expression=remapExpressionTables(original.expression,mapping);insert(db,logical,row);}
  if(securitySeparated(db))insert(db,'_application_builders',{app_id:target.id,user_id:actor.id});else if(actor.role!=='owner')insert(db,'_application_roles',{app_id:target.id,role_name:actor.role,can_use:1,builder:1});
  if((db.pragma('foreign_key_check') as unknown[]).length)throw new AuthError('ข้อมูลอ้างอิงของแอพโคลนไม่ถูกต้อง ยกเลิกการโคลนแล้ว');installAuditing(db);
  return {...applications(actor).find(a=>a.id===target.id)!,table_mapping:mapping};
 }).immediate();
}
export function deleteApplication(actor:AuthUser,id:unknown){
 const app=assertManageApplication(actor,id);if(app.id==='default')throw new AuthError('แอพเริ่มต้นของระบบไม่สามารถลบได้');const db=platformDatabase();
 return db.transaction(()=>{if(db.prepare('SELECT 1 FROM '+quote(applicationTable(app.id,'_automation_jobs'))+" WHERE status IN ('queued','running') LIMIT 1").get())throw new AuthError('ยังมี Automation รอทำงานหรือกำลังทำงาน กรุณารอหรือยกเลิกงานก่อนลบแอพ',409);
  db.prepare("UPDATE _tables SET owner_app_id='default' WHERE owner_app_id=?").run(app.id);
  db.prepare('DELETE FROM _application_members WHERE app_id=?').run(app.id);
  for(const name of ['_user_setting_values','_user_setting_defs','_role_actions','_automation_jobs','_automations','_pdf_templates','_app_versions','_views','_actions','_slices','_app_settings'])db.exec('DROP TABLE '+quote(applicationTable(app.id,name)));
  db.prepare('DELETE FROM _applications WHERE id=?').run(app.id);if((db.pragma('foreign_key_check') as unknown[]).length)throw new AuthError('ข้อมูลอ้างอิงไม่ถูกต้อง ยกเลิกการลบแอพแล้ว');return {ok:true};
 }).immediate();
}
