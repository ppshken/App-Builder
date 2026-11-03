import {MAX_SHARED_TABLE_SELECTION} from './shared-table-schema';
import {createHash} from 'node:crypto';
import {db,platformDatabase,applicationDatabase,columnsOf} from './db';
import {currentApplication,applicationTable} from './application-context';
import {applications,assertManageApplication} from './applications';
import {currentUser} from './permissions';
import {AuthError} from './auth';
import {assertIdentifier,assertFormulas,assertLabels,type Column} from './columns';
import {normalizeColumns} from './metadata';
import {createDefaultViews} from './schema';
import {readColumns} from './schema';
import {sourceApplicationLabel,tableOverlay,physicalColumns,physicalHash,effectiveColumns,importedColumn,type TableOverlay} from './shared-table-columns';
import {inspectApp} from './readiness';
const operations=['read','create','update','delete','export'] as const;
export function sharedTableContext(){const app=currentApplication(),user=currentUser();if(!app||!user)throw new AuthError('กรุณาเลือกแอป',403);assertManageApplication(user,app.id);return {app,user,database:platformDatabase()};}
const context=sharedTableContext;
function source(table:string){assertIdentifier(table);const row=platformDatabase().prepare('SELECT name,label,owner_app_id,source_kind FROM _tables WHERE name=?').get(table) as {name:string;label:string;owner_app_id:string;source_kind:string}|undefined;if(!row||row.source_kind==='EXTERNAL_REST_API')throw new AuthError('ไม่พบตารางกลางที่ใช้งานได้',404);return row;}
function store(table:string,value:TableOverlay){db.prepare('INSERT INTO _table_overlays(table_name,config_json) VALUES(?,?) ON CONFLICT(table_name) DO UPDATE SET config_json=excluded.config_json').run(table,JSON.stringify(value));}
function overlay(table:string){const {app,database}=context(),row=source(table);if(row.owner_app_id===app.id||!app.datasets?.[table]?.read)throw new AuthError('ตารางนี้ไม่ได้เชื่อมเป็นตารางกลาง',403);const value=tableOverlay(database,table,app.id);if(!value)throw new AuthError('กรุณานำเข้าตารางผ่านส่วนกลางก่อนตั้งค่าแยกแอป',409);return value;}
function schemas(table:string,cols:Column[]){const {app,database}=context();return Object.fromEntries(Object.keys(app.datasets||{}).filter(n=>app.datasets![n].read).map(n=>[n,n===table?cols:effectiveColumns(database,n,app.id)]));}
function dependencies(table:string,column:string){
 for(const entity of ['_views','_slices','_actions','_automations','_pdf_templates'])for(const row of db.prepare('SELECT * FROM '+entity).all() as Record<string,unknown>[]){
  // Conservative dependency guard: never silently delete a referenced virtual field.
  const text=JSON.stringify(row);if(text.includes('['+column+']')||row.table_name===table&&text.includes('\\"'+column+'\\"'))throw new AuthError('คอลัมน์นี้ยังใช้ใน '+entity+' กรุณาปรับการตั้งค่าก่อนลบ',409);
 }
}
export function sharedCatalog(){const {app,user,database}=context(),ownedApps=applications(user).filter(a=>a.can_manage),manageable=new Set(ownedApps.map(a=>a.id));
 const rows=database.prepare("SELECT t.name,t.label,t.owner_app_id,a.label source_app FROM _tables t JOIN _applications a ON a.id=t.owner_app_id WHERE t.source_kind<>'EXTERNAL_REST_API' ORDER BY t.label").all() as any[];for(const row of rows)row.source_app=sourceApplicationLabel(database,row.owner_app_id);
 return {apps:ownedApps.map(a=>({id:a.id,label:a.label})),owned:rows.filter(t=>t.owner_app_id===app.id).map(t=>({...t,grants:database.prepare('SELECT * FROM _table_shares WHERE table_name=?').all(t.name)})),tables:rows.filter(t=>t.owner_app_id!==app.id&&(database.prepare('SELECT 1 FROM _application_datasets WHERE app_id=? AND table_name=?').get(app.id,t.name)||manageable.has(t.owner_app_id)||database.prepare('SELECT 1 FROM _table_shares WHERE table_name=? AND target_app_id=? AND can_read=1').get(t.name,app.id))).map(t=>{const grant=database.prepare('SELECT * FROM _table_shares WHERE table_name=? AND target_app_id=?').get(t.name,app.id) as any;const connected=!!database.prepare('SELECT 1 FROM _application_datasets WHERE app_id=? AND table_name=?').get(app.id,t.name),readable=!!app.datasets?.[t.name]?.read;const columns=connected&&!readable&&!manageable.has(t.owner_app_id)?tableOverlay(database,t.name,app.id)?.snapshot||[]:physicalColumns(database,t.name);return {...t,columns:columns.map(c=>({name:c.name,label:c.label,type:c.type,ref_table:c.ref_table})),connected,readable,rights:Object.fromEntries(operations.map(op=>[op,grant?!!grant['can_'+op]:op==='read']))};})};
}
export function sharedTableInfo(table:string){const {app,database}=context(),row=source(table),value=tableOverlay(database,table,app.id);if(row.owner_app_id!==app.id&&!app.datasets?.[table]?.read)throw new AuthError('ไม่มีสิทธิ์ดูตารางนี้',403);return {...row,source_app:sourceApplicationLabel(database,row.owner_app_id),shared:row.owner_app_id!==app.id,configured:!!value,stale:!!value&&physicalHash(value.snapshot)!==physicalHash(physicalColumns(database,table)),overlay:value?{...value,snapshot:value.snapshot.map(importedColumn)}:undefined};}
export function shareTable(body:Record<string,any>){const {app,user,database}=context(),row=source(body.table);if(row.owner_app_id!==app.id)throw new AuthError('เฉพาะแอปเจ้าของตารางที่กำหนดการแชร์ได้',403);
 if(!applications(user).some(a=>a.id===body.target_app_id)||body.target_app_id===app.id)throw new AuthError('ไม่พบแอปปลายทางที่มีสิทธิ์จัดการ',403);
 const rights=body.rights;if(!rights||operations.some(op=>typeof rights[op]!=='boolean')||!rights.read&&operations.some(op=>op!=='read'&&rights[op]))throw Error('กรุณาระบุสิทธิ์ตารางให้ครบ และอนุญาตอ่านก่อนสิทธิ์อื่น');
 database.prepare('INSERT INTO _table_shares(table_name,target_app_id,can_read,can_create,can_update,can_delete,can_export) VALUES(?,?,?,?,?,?,?) ON CONFLICT(table_name,target_app_id) DO UPDATE SET can_read=excluded.can_read,can_create=excluded.can_create,can_update=excluded.can_update,can_delete=excluded.can_delete,can_export=excluded.can_export').run(row.name,body.target_app_id,...operations.map(op=>Number(rights[op])));return {ok:true};
}
function importOneSharedTable(table:string,requested:ReadonlySet<string>){const {app,database,user}=context(),row=source(table);if(row.owner_app_id===app.id)throw Error('ตารางนี้เป็นของแอปอยู่แล้ว');if(app.datasets?.[table]?.read)throw new AuthError('ตารางนี้เชื่อมอยู่แล้ว',409);
 let grant=database.prepare('SELECT * FROM _table_shares WHERE table_name=? AND target_app_id=?').get(table,app.id) as any;
 if(grant&&!grant.can_read)throw new AuthError('ต้นทางระงับสิทธิ์อ่าน กรุณาอนุญาตใหม่จากแอปต้นทางก่อนนำเข้า',403);
 if(!grant){if(!applications(user).some(a=>a.id===row.owner_app_id&&a.can_manage))throw new AuthError('ไม่มีสิทธิ์นำเข้าตารางนี้',403);grant={can_read:1,can_create:0,can_update:0,can_delete:0,can_export:0};}
 const snapshot=physicalColumns(database,table);if(!snapshot.length)throw Error('ตารางต้นทางไม่มีคอลัมน์จริง');
 const missing=[...new Set(snapshot.map(c=>c.ref_table).filter((name):name is string=>!!name&&name!==table&&!app.datasets?.[name]?.read&&!requested.has(name)))];if(missing.length)throw Error('กรุณาเชื่อมตารางอ้างอิงก่อน: '+missing.join(', '));
 database.transaction(()=>{
  if(database.prepare('SELECT 1 FROM _application_datasets WHERE app_id=? AND table_name=? AND can_read=1').get(app.id,table)||tableOverlay(database,table,app.id))throw new AuthError('ตารางนี้เชื่อมอยู่แล้ว กรุณาโหลดหน้าใหม่',409);
  database.prepare('INSERT INTO _table_shares(table_name,target_app_id,can_read,can_create,can_update,can_delete,can_export) VALUES(?,?,?,?,?,?,?) ON CONFLICT(table_name,target_app_id) DO NOTHING').run(table,app.id,...operations.map(op=>Number(grant['can_'+op])));
  database.prepare('INSERT INTO _application_datasets(app_id,table_name,can_read,can_create,can_update,can_delete,can_export) VALUES(?,?,?,?,?,?,?) ON CONFLICT(app_id,table_name) DO UPDATE SET can_read=excluded.can_read,can_create=excluded.can_create,can_update=excluded.can_update,can_delete=excluded.can_delete,can_export=excluded.can_export').run(app.id,table,...operations.map(op=>Number(grant['can_'+op])));
  store(table,{version:1,label:'',snapshot,overrides:{},virtuals:[],synced_at:Date.now()});
  const prior=app.datasets?.[table];if(app.datasets)app.datasets[table]=Object.fromEntries(operations.map(op=>[op,!!grant['can_'+op]])) as any;
  try{createDefaultViews(applicationDatabase(database,app.id),table,row.label);}finally{if(app.datasets){if(prior)app.datasets[table]=prior;else delete app.datasets[table];}}
 }).immediate();return {ok:true,table};
}
export function sharedTableSelection(input:unknown){
 if(!Array.isArray(input)||!input.length||input.length>MAX_SHARED_TABLE_SELECTION)throw Error('เลือกตาราง 1–'+MAX_SHARED_TABLE_SELECTION+' ตาราง');
 for(const name of input)assertIdentifier(name);return [...new Set(input as string[])].sort();
}
export function importSharedTables(input:unknown){const tables=sharedTableSelection(input),{database}=context(),requested=new Set(tables);
 return database.transaction(()=>{for(const table of tables)importOneSharedTable(table,requested);return {ok:true,tables,total:tables.length};}).immediate();
}
export function importSharedTable(table:string){return {...importSharedTables([table]),table};}
export function saveSharedSettings(table:string,body:Record<string,any>){const value=overlay(table),{database,app}=context();
 if(body.op==='label'){if(typeof body.label!=='string'||!body.label.trim()||body.label.length>100)throw Error('กรอกชื่อตาราง 1–100 ตัวอักษร');value.label=body.label.trim();}
 else if(body.op==='column'){const actual=physicalColumns(database,table).find(c=>c.name===body.name);if(!actual||!value.snapshot.some(c=>c.id===actual.id))throw Error('ไม่พบคอลัมน์จริง กรุณารีเจน');if(typeof body.label!=='string'||!body.label.trim()||body.label.length>100||typeof body.is_label!=='boolean')throw Error('การตั้งค่าคอลัมน์ไม่ถูกต้อง');
  if(body.is_label){for(const c of value.snapshot.filter(c=>(c.type==='image')===(actual.type==='image')))value.overrides[String(c.id)]={...value.overrides[String(c.id)],is_label:false};for(const c of value.virtuals.filter(c=>(c.type==='image')===(actual.type==='image')))c.is_label=false;}
  value.overrides[String(actual.id)]={label:body.label.trim(),is_label:body.is_label};
 }else if(body.op==='virtual'){
  if(!body.column||typeof body.column!=='object')throw Error('กรุณาระบุคอลัมน์คำนวณ');const c=body.column;assertIdentifier(c.name);if(readColumns(database,table).some(p=>p.name===c.name&&(!p.is_virtual||body.original!==c.name||!value.virtuals.some(v=>v.name===c.name))))throw Error('ชื่อซ้ำกับคอลัมน์ต้นทาง');
  if(body.original&&body.original!==c.name)throw Error('เปลี่ยนชื่อช่องคำนวณโดยสร้างช่องใหม่และแก้สูตรที่เกี่ยวข้องก่อน');
  if(!body.original&&value.virtuals.some(v=>v.name===c.name))throw Error('ชื่อคอลัมน์คำนวณซ้ำ');if(body.original&&!value.virtuals.some(v=>v.name===body.original))throw Error('ไม่พบคอลัมน์คำนวณ');
  const physical=effectiveColumns(database,table,app.id).filter(v=>!v.is_virtual),all=[...physical,...value.virtuals.filter(v=>v.name!==body.original),{...c,is_virtual:1,is_key:0,is_unique:0,auto_number:null,default_expr:null}];
  const normalized=normalizeColumns(all,{[table]:all});assertFormulas(normalized,schemas(table,normalized));value.virtuals=normalized.filter(v=>v.is_virtual);
 }else if(body.op==='drop_virtual'){if(!value.virtuals.some(c=>c.name===body.name))throw Error('ไม่พบคอลัมน์คำนวณ');dependencies(table,body.name);value.virtuals=value.virtuals.filter(c=>c.name!==body.name);assertFormulas([...value.snapshot.map(importedColumn),...value.virtuals],schemas(table,[...value.snapshot.map(importedColumn),...value.virtuals]));}
 else throw Error('การตั้งค่าไม่ถูกต้อง');
 const candidate=[...value.snapshot.map(c=>({...importedColumn(c),...value.overrides[String(c.id)]})),...value.virtuals];assertLabels(candidate);const catalog=schemas(table,candidate);assertFormulas(candidate,catalog);
 if(['virtual','drop_virtual'].includes(body.op))for(const columns of Object.values(catalog))assertFormulas(columns,catalog);
 store(table,value);return {ok:true};
}
export function regenerateShared(table:string,token?:string){const value=overlay(table),{database}=context(),latest=physicalColumns(database,table);
 const revision=createHash('sha256').update(JSON.stringify([value,latest])).digest('hex');
 const added=latest.filter(c=>!value.snapshot.some(p=>p.id===c.id)),removed=value.snapshot.filter(c=>!latest.some(p=>p.id===c.id)),changed=latest.filter(c=>{const p=value.snapshot.find(p=>p.id===c.id);return p&&JSON.stringify(p)!==JSON.stringify(c);});
 if(token===undefined)return {token:revision,added,removed,changed};if(token!==revision)throw new AuthError('โครงสร้างเปลี่ยนระหว่างตรวจ กรุณาตรวจใหม่',409);
 // Destructive source changes are blocked while shared; never guess how to repair dependencies.
 if(removed.length||changed.some(c=>{const p=value.snapshot.find(p=>p.id===c.id)!;return p.name!==c.name||p.type!==c.type||p.ref_table!==c.ref_table;}))throw new AuthError('พบการเปลี่ยนโครงสร้างที่มีผลต่อข้อมูล กรุณาตรวจการอ้างอิงก่อนรีเจน',409);
 const missing=latest.find(c=>c.ref_table&&c.ref_table!==table&&!currentApplication()?.datasets?.[c.ref_table]?.read);if(missing)throw Error('กรุณาเชื่อมตารางอ้างอิงของ '+missing.label+' ก่อนรีเจน');
 if(added.some(c=>value.virtuals.some(v=>v.name===c.name)))throw new AuthError('คอลัมน์ใหม่ชื่อซ้ำกับช่องคำนวณของแอป กรุณาแก้ก่อนรีเจน',409);
 value.snapshot=latest;value.synced_at=Date.now();
 database.transaction(()=>{store(table,value);const report=inspectApp();if(report.errors)throw new AuthError('รีเจนไม่ได้: '+report.issues.filter(i=>i.severity==='error').map(i=>i.message).slice(0,3).join(' · '),409);})();return {ok:true};
}
