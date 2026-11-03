import Database from 'better-sqlite3';
import {withDatabase} from './db';
import {insertColumn} from './metadata';
import {tableOverlay,effectiveColumns} from './shared-table-columns';
import {readColumns} from './schema';
import {assertFormulas} from './columns';
// A new independent app materializes local virtuals/labels into its own metadata.
// Stored data and physical schema are unchanged; source virtuals are not imported.
export function exportedColumnRows(database:Database.Database,table:string,app:string):Record<string,any>[]{
 const raw=database.prepare('SELECT * FROM _columns WHERE table_name=? ORDER BY pos,id').all(table) as Record<string,any>[];
 const overlay=tableOverlay(database,table,app);if(!overlay)return raw;
 try{assertFormulas([...readColumns(database,table).filter(c=>!c.is_virtual),...overlay.virtuals]);}
 catch{throw Error('ยังสร้างฐานข้อมูลแยกไม่ได้: กฎบันทึกต้นทางอ้างคอลัมน์คำนวณที่ไม่ได้นำเข้า กรุณาปรับกฎหรือใช้ข้อมูลร่วมกัน');}
 const effective=effectiveColumns(database,table,app),out=raw.filter(c=>!c.is_virtual).map(c=>{const local=effective.find(v=>v.name===c.name);return {...c,...(local?{label:local.label,is_label:Number(!!local.is_label)}:{})};});
 const temporary=new Database(':memory:');try{
  temporary.pragma('foreign_keys=OFF'); // Metadata serialization only; no business rows exist here.
  temporary.exec((database.prepare("SELECT sql FROM sqlite_master WHERE name='_columns'").get() as {sql:string}).sql);
  withDatabase(temporary,()=>{for(const c of overlay.virtuals)insertColumn(table,c);});
  for(const row of temporary.prepare('SELECT * FROM _columns ORDER BY pos,id').all() as Record<string,any>[]){const {id,...column}=row;out.push(column);}
 }finally{temporary.close();}return out;
}
