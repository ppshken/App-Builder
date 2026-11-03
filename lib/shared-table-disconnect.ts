import {createHash} from 'node:crypto';
import {db,applicationDatabase} from './db';
import {AuthError} from './auth';
import {sharedTableContext,sharedTableSelection} from './shared-tables';
import {tableOverlay} from './shared-table-columns';
import {inspectApp,type HealthIssue} from './readiness';
import {backupBeforeSchema} from './database-backup';
const resources=[['_views','View'],['_slices','Slice'],['_actions','Action'],['_automations','Automation'],['_pdf_templates','แม่แบบ PDF']] as const;
function selectedLinks(input:unknown){const tables=sharedTableSelection(input),{app,database}=sharedTableContext();for(const table of tables){const link=database.prepare('SELECT t.owner_app_id FROM _tables t JOIN _application_datasets d ON d.table_name=t.name WHERE d.app_id=? AND t.name=?').get(app.id,table) as {owner_app_id:string}|undefined;if(!link||link.owner_app_id===app.id)throw new AuthError('ไม่พบการเชื่อมตารางกลางของแอปนี้',403);}return {tables,app,database};}
function fingerprint(tables:string[]){const {app,database}=sharedTableContext(),configured=applicationDatabase(database,app.id);const state:unknown[]=[app.id,tables];for(const name of [...resources.map(r=>r[0]),'_table_overlays','_app_settings','_role_actions','_user_setting_defs'])state.push([name,configured.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]);for(const name of ['_application_datasets','_application_role_tables','_application_role_rows','_application_role_actions'])state.push([name,database.prepare('SELECT * FROM '+name+' WHERE app_id=? ORDER BY rowid').all(app.id)]);state.push(activeJobs(tables));state.push(database.prepare('SELECT id,table_name,name,type,ref_table,is_virtual,virtual_expr,default_expr,show_if,valid_if,required_if,editable_if FROM _columns ORDER BY id').all());return createHash('sha256').update(JSON.stringify(state)).digest('hex');}
function activeJobs(tables:string[]){
 const names=JSON.stringify(tables),actions=new Set((db.prepare('SELECT name FROM _actions WHERE table_name IN (SELECT value FROM json_each(?))').all(names) as {name:string}[]).map(a=>a.name)),templates=new Set((db.prepare('SELECT name FROM _pdf_templates WHERE table_name IN (SELECT value FROM json_each(?))').all(names) as {name:string}[]).map(t=>t.name));
 return (db.prepare("SELECT id,label,status,updated_at,table_name,config_json FROM _automation_jobs WHERE status IN ('queued','running') ORDER BY id").all() as {id:string;label:string;status:string;updated_at:number;table_name:string;config_json:string}[]).filter(job=>{
  if(tables.includes(job.table_name))return true;
  try{const config=JSON.parse(job.config_json);return (config.steps||[]).some((step:any)=>step.kind==='action'&&actions.has(step.action_name)||step.kind==='pdf'&&templates.has(step.template_name));}catch{return true;}
 }).map(({id,label,status,updated_at})=>({id,label,status,updated_at}));
}
function removeLocalConfiguration(tables:string[]){const {app,database}=sharedTableContext(),names=JSON.stringify(tables);const views=db.prepare('SELECT name FROM _views WHERE table_name IN (SELECT value FROM json_each(?))').all(names) as {name:string}[];const actions=db.prepare('SELECT name FROM _actions WHERE table_name IN (SELECT value FROM json_each(?))').all(names) as {name:string}[];const actionNames=JSON.stringify(actions.map(a=>a.name));
 db.prepare('DELETE FROM _role_actions WHERE action_name IN (SELECT value FROM json_each(?))').run(actionNames);
 database.prepare('DELETE FROM _application_role_actions WHERE app_id=? AND action_name IN (SELECT value FROM json_each(?))').run(app.id,actionNames);
 for(const [entity] of resources)db.prepare('DELETE FROM '+entity+' WHERE table_name IN (SELECT value FROM json_each(?))').run(names);
 db.prepare('DELETE FROM _table_overlays WHERE table_name IN (SELECT value FROM json_each(?))').run(names);
 for(const entity of ['_application_role_tables','_application_role_rows'])database.prepare('DELETE FROM '+entity+' WHERE app_id=? AND table_name IN (SELECT value FROM json_each(?))').run(app.id,names);
 database.prepare('DELETE FROM _application_datasets WHERE app_id=? AND table_name IN (SELECT value FROM json_each(?))').run(app.id,names);
 return views.map(v=>v.name);
}
function remainingProblems(tables:string[],removedViews:string[]){const {app}=sharedTableContext(),prior={...app.datasets};try{for(const table of tables)if(app.datasets)delete app.datasets[table];const issues=inspectApp().issues.filter(i=>i.severity==='error');
  const visit=(value:unknown,path:string)=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(typeof item==='string'&&(key.endsWith('_view')||key==='view_name')&&removedViews.includes(item))issues.push({kind:'settings',name:path+key,label:'การตั้งค่าแอป',severity:'error',message:'การตั้งค่า '+path+key+' ยังใช้ View ที่จะนำออก',href:'/settings'});else if(item&&typeof item==='object')visit(item,path+key+'.');}};
  const settings=db.prepare('SELECT * FROM _app_settings WHERE id=1').get() as Record<string,unknown>;visit(Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,key.endsWith('_json')&&typeof value==='string'?JSON.parse(value):value])), '');return issues;
 }finally{if(app.datasets)Object.assign(app.datasets,prior);}}
export function previewSharedDisconnect(input:unknown){const {tables,app,database}=selectedLinks(input),names=JSON.stringify(tables),token=fingerprint(tables);
 const removed=resources.map(([entity,label])=>({kind:label,items:db.prepare('SELECT name,label FROM '+entity+' WHERE table_name IN (SELECT value FROM json_each(?)) ORDER BY name').all(names) as {name:string;label:string}[]}));
 const virtuals=tables.flatMap(table=>(tableOverlay(database,table,app.id)?.virtuals||[]).map(c=>({table,name:c.name,label:c.label})));
 const jobs=activeJobs(tables);let blockers:Pick<HealthIssue,'kind'|'label'|'message'|'href'>[]=[];const rollback={};
 try{database.transaction(()=>{const removedViews=removeLocalConfiguration(tables);blockers=remainingProblems(tables,removedViews);throw rollback;})();}catch(error){if(error!==rollback)throw error;}
 blockers.push(...jobs.map(job=>({kind:'job',label:job.label,message:'มี Automation '+job.status+' กรุณารอหรือยกเลิกงานก่อน',href:'/workflows?history=1'})));
 return {token,tables,removed,virtuals,blockers,allowed:!blockers.length,source_data_untouched:true};
}
export function disconnectSharedTables(input:unknown,token:unknown,confirmation:unknown){if(typeof token!=='string'||confirmation!=='ยกเลิกเชื่อมต่อ')throw Error('กรุณายืนยันการยกเลิกเชื่อมต่อ');const {tables,database}=selectedLinks(input);
 if(fingerprint(tables)!==token)throw new AuthError('การตั้งค่าเปลี่ยนหลังตรวจผลกระทบ กรุณาตรวจใหม่',409);
 const preview=previewSharedDisconnect(tables);if(!preview.allowed)throw new AuthError('ยกเลิกไม่ได้: '+preview.blockers.map(b=>b.message).slice(0,3).join(' · '),409);
 backupBeforeSchema();
 database.transaction(()=>{if(fingerprint(tables)!==token||activeJobs(tables).length)throw new AuthError('ผลกระทบเปลี่ยน กรุณาตรวจใหม่',409);const removedViews=removeLocalConfiguration(tables);const problems=remainingProblems(tables,removedViews);if(problems.length)throw new AuthError('ยกเลิกไม่ได้: '+problems.slice(0,3).map(i=>i.message).join(' · '),409);}).immediate();
 return {ok:true,tables,total:tables.length,source_data_untouched:true};
}
