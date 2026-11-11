import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {applicationTable,currentApplication} from './application-context';
import {readColumns} from './schema';
import {FORMULA_FIELDS,assertIdentifier,SQLTYPE,type Column} from './columns';
export type PhysicalColumn=Column&{id:number};
export type TableOverlay={version:1;label:string;snapshot:PhysicalColumn[];overrides:Record<string,{label?:string;is_label?:boolean}>;virtuals:Column[];synced_at:number};
// Call with the raw platform connection so the source name is not SQL-routed to the recipient.
export function sourceApplicationLabel(database:Database.Database,id:string){return (database.prepare('SELECT name FROM "'+applicationTable(id,'_app_settings')+'" WHERE id=1').get() as {name:string}|undefined)?.name||(database.prepare('SELECT label FROM _applications WHERE id=?').get(id) as {label:string}|undefined)?.label||id;}
export function physicalColumns(database:Database.Database,table:string){return readColumns(database,table).filter(c=>!c.is_virtual) as PhysicalColumn[];}
export function physicalHash(columns:PhysicalColumn[]){return createHash('sha256').update(JSON.stringify(columns.map(({invalid_value_error,part_invalid_value_error,...column})=>({...column,...(invalid_value_error?.trim()?{invalid_value_error:invalid_value_error.trim()}:{}),...(part_invalid_value_error?.trim()?{part_invalid_value_error:part_invalid_value_error.trim()}:{})})))).digest('hex');}
export function tableOverlay(database:Database.Database,table:string,app=currentApplication()?.id):TableOverlay|undefined{
 if(!app)return;
 const store=applicationTable(app,'_table_overlays');
 if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(store))return;
 const row=database.prepare('SELECT config_json FROM "'+store+'" WHERE table_name=?').get(table) as {config_json:string}|undefined;
 if(row){
  const value=JSON.parse(row.config_json) as TableOverlay;
  if(!value||value.version!==1||typeof value.label!=='string'||value.label.length>100||!Array.isArray(value.snapshot)||!Array.isArray(value.virtuals)||value.snapshot.length+value.virtuals.length>200||!value.overrides||typeof value.overrides!=='object'||Array.isArray(value.overrides))throw Error('การตั้งค่าตารางร่วมไม่ถูกต้อง');
  for(const c of [...value.snapshot,...value.virtuals]){assertIdentifier(c.name);if(!Object.hasOwn(SQLTYPE,c.type)||typeof c.label!=='string')throw Error('คอลัมน์ตารางร่วมไม่ถูกต้อง');if(c.ref_table)assertIdentifier(c.ref_table);}
  if(value.snapshot.some(c=>!Number.isSafeInteger(c.id)||c.id<1||c.is_virtual)||value.virtuals.some(c=>!c.is_virtual||c.is_key||c.is_unique||c.auto_number||c.default_expr))throw Error('โครงสร้างคอลัมน์ตารางร่วมไม่ถูกต้อง');
  if(new Set([...value.snapshot,...value.virtuals].map(c=>c.name)).size!==value.snapshot.length+value.virtuals.length)throw Error('ชื่อตารางร่วมซ้ำ');
  for(const [id,override] of Object.entries(value.overrides))if(!/^\d+$/.test(id)||!override||Object.keys(override).some(k=>!['label','is_label'].includes(k))||override.label!==undefined&&(typeof override.label!=='string'||!override.label.trim()||override.label.length>100)||override.is_label!==undefined&&typeof override.is_label!=='boolean')throw Error('ค่าทับคอลัมน์ตารางร่วมไม่ถูกต้อง');
  return value;
 }
}
export function importedColumn(column:Column):Column{
 const out={...column};for(const field of FORMULA_FIELDS)out[field]=null;
 // Rules which mutate stored values belong to the owning table's write path.
 out.reset_on_edit=0;out.reset_columns=[];return out;
}
export function effectiveColumns(database:Database.Database,table:string,app=currentApplication()?.id):Column[]{
 const source=readColumns(database,table),overlay=tableOverlay(database,table,app);if(!overlay)return source;
 const physical=source.filter(c=>!c.is_virtual) as PhysicalColumn[];
 const columns=overlay.snapshot.flatMap(prior=>{
  const live=physical.find(c=>c.id===prior.id&&c.name===prior.name&&c.type===prior.type&&c.ref_table===prior.ref_table);
  return live?[{...importedColumn(live),...overlay.overrides[String(live.id)]}]:[];
 });
 return [...columns,...overlay.virtuals];
}
export function writeColumns(database:Database.Database,table:string,app=currentApplication()?.id):Column[]{
 const overlay=tableOverlay(database,table,app);if(!overlay)return readColumns(database,table);
 const live=physicalColumns(database,table);
 if(physicalHash(live)!==physicalHash(overlay.snapshot))throw Object.assign(Error('โครงสร้างตารางกลางเปลี่ยน กรุณารีเจนคอลัมน์ก่อนบันทึก'),{status:409});
 // Preserve source defaults, validation, editability, numbering and stored-field rules.
 const source=readColumns(database,table);
 if(overlay.virtuals.some(local=>source.some(c=>c.name===local.name)))throw Object.assign(Error('ช่องคำนวณของแอปชื่อซ้ำกับคอลัมน์ต้นทาง กรุณาเปลี่ยนชื่อก่อนบันทึก'),{status:409});
 // Source virtuals remain internal to validation; they are never exposed as imported fields.
 return [...source,...overlay.virtuals];
}
