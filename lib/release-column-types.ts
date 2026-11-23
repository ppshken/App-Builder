import {SQLTYPE} from './columns';
import type {ReleaseCatalog,ReleaseOperation} from './release-plan';

// These families normalize existing values identically. No row conversion or DDL
// is permitted here; changed constraints still require full live-row validation.
const families=[['text','longtext','enum'],['number','decimal']];
export function preservingColumnTypeChange(op:ReleaseOperation,live:ReleaseCatalog,next:ReleaseCatalog){
 if(op.kind!=='alter_column'||!op.id.startsWith('_columns:'))return false;
 const after=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
 const before=live._columns.find(c=>c.table_name===op.table&&c.id===after?.id);
 if(!before||!after)return false;
 if(!['id','table_name','name','is_virtual','is_key','is_unique'].every(k=>(before[k]??null)===(after[k]??null)))return false;
 const changesTarget=(before.ref_table??null)!==(after.ref_table??null);
 if(changesTarget){
  // Physical Ref targets are part of the SQLite foreign key definition.
  if(!after.is_virtual&&[before.type,after.type].some(type=>type==='ref'||type==='list'))return false;
  if(after.ref_table){
   if(!['ref','list','enum','enumlist'].includes(String(after.type)))return false;
   const target=next._tables.find(t=>t.name===after.ref_table);
   if(!target||target.owner_app_id!==planOwner(next,after)||target.source_kind!=='INTERNAL_DATABASE')return false;
  }
 }
 if(before.type===after.type)return changesTarget;
 if(after.is_virtual)return !!SQLTYPE[String(after.type)];
 return families.some(f=>f.includes(String(before.type))&&f.includes(String(after.type)))&&SQLTYPE[String(before.type)]===SQLTYPE[String(after.type)];
}

function planOwner(catalog:ReleaseCatalog,column:Record<string,unknown>){
 return catalog._tables.find(table=>table.name===column.table_name)?.owner_app_id;
}

/** Stable column IDs prove a rename rather than a delete followed by an add. */
export function releaseColumnRename(op:ReleaseOperation,live:ReleaseCatalog,next:ReleaseCatalog) {
 if(op.kind!=='alter_column'||!op.fields?.includes('name'))return;
 const after=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
 const before=after&&live._columns.find(c=>c.table_name===op.table&&c.id===after.id);
 if(!before||!after||before.name===after.name||before.name==='id'||after.name==='id')return;
 if(!['id','table_name','type','is_virtual','is_key','is_unique','ref_table'].every(k=>(before[k]??null)===(after[k]??null)))return;
 if(live._columns.some(c=>c.table_name===op.table&&c.name===after.name))return;
 return {table:String(op.table),before:String(before.name),after:String(after.name),id:after.id,virtual:!!after.is_virtual};
}

export function releaseColumnRemoval(op:ReleaseOperation,live:ReleaseCatalog,next:ReleaseCatalog) {
 if(op.kind!=='delete_column')return;
 const column=live._columns.find(c=>c.table_name===op.table&&c.name===op.name);
 if(!column||column.name==='id'||column.is_key||column.is_unique||column.type==='ref'&&!column.is_virtual)return;
 if(next._columns.some(c=>c.table_name===op.table&&(c.id===column.id||c.name===column.name)))return;
 if(!next._columns.some(c=>c.table_name===op.table))return;
 return {table:String(op.table),name:String(column.name),id:column.id,virtual:!!column.is_virtual};
}

export function releaseValueRewrite(op:ReleaseOperation,live:ReleaseCatalog,next:ReleaseCatalog){
 if(op.kind!=='alter_column'||preservingColumnTypeChange(op,live,next))return;
 const after=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
 const before=after&&live._columns.find(c=>c.table_name===op.table&&c.id===after.id);
 if(!before||!after||before.name!==after.name||before.is_virtual||after.is_virtual||
    !!before.is_key!==!!after.is_key||!!before.is_unique!==!!after.is_unique||[before,after].some(c=>c.auto_number_json&&c.auto_number_json!=='null'))return;
 if(before.type===after.type&&(before.ref_table??null)===(after.ref_table??null))return;
 if(after.ref_table&&!next._tables.some(t=>t.name===after.ref_table&&t.owner_app_id===planOwner(next,after)&&t.source_kind==='INTERNAL_DATABASE'&&live._tables.some(old=>old.name===t.name)))return;
 if(!Object.hasOwn(SQLTYPE,String(before.type))||!Object.hasOwn(SQLTYPE,String(after.type)))return;
 return {before,after};
}
