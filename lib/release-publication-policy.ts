import type {ReleaseCatalog,ReleasePlan} from './release-plan';
import {preservingColumnTypeChange,releaseColumnRename,releaseValueRewrite} from './release-column-types';
import {rehearsalEligibility} from './release-rehearsal';
export function schemaPublicationEnabled(value:string|undefined=process.env.NOCODE_SCHEMA_PUBLICATION){return value==='1';}
export function samePublicationSource(expected:{connection:unknown;generation:number;identity:string},current:{connection:unknown;generation:number;identity:string}){return expected.connection===current.connection&&expected.generation===current.generation&&expected.identity===current.identity;}
const presentationFields=['label','pos','is_label','input_mode','button_limit','list_limit'];
const ruleFields=['required','required_if','default_expr','valid_if','show_if','editable_if','is_editable','reset_on_edit','reset_columns_json','invalid_value_error','options','max_length','part_show_if','part_add_if','part_valid_if','part_invalid_value_error','is_part_of','related_required'];
export const configurationPublicationCollections = ['_app_settings','_views','_slices','_pdf_templates','_actions','_automations'] as const;
export function configurationOnlyPublication(plan: ReleasePlan) {
 return plan.operations.length > 0 && plan.operations.every(operation =>
  operation.category === 'configuration' && configurationPublicationCollections.some(collection => operation.id.startsWith(collection+':')) &&
  (!operation.id.startsWith('_actions:') || operation.kind === 'update_configuration'));
}
export function requiresPublicationRowValidation(plan:ReleasePlan,next:ReleaseCatalog){return plan.operations.some(op=>op.kind==='delete_table'||op.id.startsWith('_columns:')&&(op.kind==='create_column'||op.kind==='alter_column'||op.kind==='delete_column'||op.fields.some(k=>k==='virtual_expr'||ruleFields.includes(k))));}
export function publicationBlockers(plan:ReleasePlan,live:ReleaseCatalog,next:ReleaseCatalog,shared:string[],_autoGrantRoles:number){
 const reasons=rehearsalEligibility(plan,live,next);
 for(const op of plan.operations){
  if(op.category==='shared')reasons.push('ยังไม่เผยแพร่การตั้งค่าตารางร่วม');
  if(op.table&&live._tables.some(t=>t.name===op.table&&t.owner_app_id!==plan.appId)&&(op.id.startsWith('_columns:')||op.id.startsWith('_tables:')))reasons.push('ไม่แก้คอลัมน์ต้นทางของแอปอื่น');
  if(op.category==='schema'&&shared.includes(op.table!))reasons.push('ยังเผยแพร่โครงสร้างตารางที่มีแอปอื่นเชื่อมอยู่ไม่ได้');
  const column=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
  if(op.id.startsWith('_columns:')&&(op.kind==='create_column'||op.fields?.some(k=>['is_part_of','related_required','part_valid_if','part_show_if','part_add_if'].includes(k)))&&(column?.is_part_of||column?.related_required)){
   const parent=next._tables.find(t=>t.name===column.ref_table);
   if(!parent||parent.owner_app_id!==plan.appId||parent.source_kind!=='INTERNAL_DATABASE'||shared.includes(String(parent.name)))reasons.push('เงื่อนไขรายการลูกต้องใช้ตารางแม่ของแอปที่ไม่มีแอปอื่นเชื่อม');
  }
  if(op.id.startsWith('_columns:')&&op.kind==='update_configuration'&&op.fields?.some(k=>['is_part_of','related_required'].includes(k))&&(column?.type!=='ref'||column?.is_virtual||!column?.ref_table))reasons.push('เงื่อนไขรายการลูกใช้กับ Ref จริงเท่านั้น');
  if(op.kind==='create_column'){
   if(column&&(column.is_part_of||column.related_required)&&(column.type!=='ref'||column.is_virtual||!column.ref_table))reasons.push('เงื่อนไขรายการลูกใช้กับ Ref จริงที่เลือกตารางแม่เท่านั้น');
   const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
   if(c?.is_virtual&&(!String(c.virtual_expr||'').trim()||c.is_key||c.is_unique))reasons.push('คอลัมน์คำนวณใหม่ต้องมีสูตรและไม่เป็น Key/ห้ามซ้ำ');
  }
  if(op.id.startsWith('_columns:')&&['update_configuration','alter_column'].includes(op.kind)){
   const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name),old=live._columns.find(previous=>previous.table_name===op.table&&previous.id===c?.id);
   const allowed=[...presentationFields,...ruleFields,...(releaseColumnRename(op,live,next)?['name']:[]),...(releaseValueRewrite(op,live,next)?['type','ref_table','scan_enabled','ref_allow_add','ref_delete_cascade','image_path','file_path','gps_auto']:[]),...(preservingColumnTypeChange(op,live,next)?['type','ref_table']:[]),...(c&&old&&(c.is_virtual&&old.is_virtual||!c.is_virtual&&!old.is_virtual&&!String(c.virtual_expr||'').trim()&&!String(old.virtual_expr||'').trim())?['virtual_expr']:[])];
   const unsupported=op.fields.filter(k=>!allowed.includes(k));if(unsupported.length)reasons.push(op.label+' · ยังไม่รองรับคุณสมบัติคอลัมน์ '+unsupported.join(', '));
   if(op.fields.some(k=>k==='virtual_expr'||ruleFields.includes(k))&&(shared.includes(op.table!)||next._tables.find(t=>t.name===op.table)?.owner_app_id!==plan.appId||next._tables.find(t=>t.name===op.table)?.source_kind!=='INTERNAL_DATABASE'))reasons.push('เปลี่ยนสูตรและเงื่อนไขได้เฉพาะตารางของแอปที่ไม่มีแอปอื่นเชื่อม');
   if(c?.is_virtual&&op.fields.includes('virtual_expr')&&!String(c.virtual_expr||'').trim())reasons.push('กรุณาระบุสูตรคอลัมน์คำนวณ');
  }
 }
 return [...new Set(reasons)];
}
