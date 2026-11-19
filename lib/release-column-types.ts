import {SQLTYPE} from './columns';
import type {ReleaseCatalog,ReleaseOperation} from './release-plan';

// These families normalize existing values identically. No row conversion or DDL
// is permitted here; changed constraints still require full live-row validation.
const families=[['text','longtext','enum'],['number','decimal']];
export function preservingColumnTypeChange(op:ReleaseOperation,live:ReleaseCatalog,next:ReleaseCatalog){
 if(op.kind!=='alter_column'||!op.id.startsWith('_columns:'))return false;
 const after=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
 const before=live._columns.find(c=>c.table_name===op.table&&c.id===after?.id);
 if(!before||!after||before.type===after.type||before.is_virtual||after.is_virtual)return false;
 if(!families.some(f=>f.includes(String(before.type))&&f.includes(String(after.type))))return false;
 if(SQLTYPE[String(before.type)]!==SQLTYPE[String(after.type)])return false;
 return ['id','table_name','name','is_virtual','is_key','is_unique','ref_table'].every(k=>(before[k]??null)===(after[k]??null));
}
