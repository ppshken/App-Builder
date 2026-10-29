import type Database from 'better-sqlite3';
import type {Column} from './columns';

export type AutoNumberConfig={prefix:string;suffix:string;digits:number;start:number};
export const AUTO_NUMBER_DEFAULTS:AutoNumberConfig={prefix:'',suffix:'',digits:5,start:1};
export const AUTO_NUMBER_SCHEMA=`CREATE TABLE IF NOT EXISTS _auto_numbers(
 table_name TEXT NOT NULL,column_name TEXT NOT NULL,last_value INTEGER NOT NULL CHECK(typeof(last_value)='integer' AND last_value>=0 AND last_value<=9007199254740991),format_key TEXT NOT NULL,
 PRIMARY KEY(table_name,column_name),FOREIGN KEY(table_name,column_name) REFERENCES _columns(table_name,name) ON UPDATE CASCADE ON DELETE CASCADE);`;

export function normalizeAutoNumber(value:unknown,column:Pick<Column,'type'|'is_virtual'|'default_expr'|'reset_on_edit'|'scan_enabled'|'editable_if'|'max_length'>):AutoNumberConfig|null{
 if(value==null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['prefix','suffix','digits','start'].includes(k)))throw Error('การตั้งค่าเลขรันอัตโนมัติไม่ถูกต้อง');
 if(column.type!=='text'||column.is_virtual)throw Error('เลขรันอัตโนมัติใช้ได้เฉพาะ Text ที่เป็นข้อมูลจริง');
 if(column.default_expr?.trim()||column.reset_on_edit||column.scan_enabled||column.editable_if?.trim())throw Error('เลขรันอัตโนมัติใช้ร่วมกับค่าเริ่มต้น Reset On Edit สแกน หรือ Editable_If ไม่ได้');
 const config={...AUTO_NUMBER_DEFAULTS,...value} as AutoNumberConfig;
 for(const key of ['prefix','suffix'] as const)if(typeof config[key]!=='string'||config[key].length>40||/[\x00-\x1f\x7f]/.test(config[key]))throw Error('ข้อความนำหน้าและต่อท้ายเลขรันต้องไม่เกิน 40 ตัวอักษรและไม่มีอักขระควบคุม');
 if(!Number.isInteger(config.digits)||config.digits<1||config.digits>16)throw Error('จำนวนหลักของเลขรันต้องเป็น 1–16');
 if(!Number.isSafeInteger(config.start)||config.start<1||config.start>=Number.MAX_SAFE_INTEGER)throw Error('เลขเริ่มต้นต้องเป็นจำนวนเต็มบวกที่น้อยกว่า 9,007,199,254,740,991');
 if(column.max_length&&config.prefix.length+config.suffix.length+Math.max(config.digits,String(config.start).length)>column.max_length)throw Error('จำนวนตัวอักษรสูงสุดสั้นกว่ารูปแบบเลขรัน');
 return config;
}
export function autoNumberText(config:AutoNumberConfig,number:number){return config.prefix+String(number).padStart(config.digits,'0')+config.suffix;}
export function assertAutoNumberColumn(column:Column){if(normalizeAutoNumber(column.auto_number,column)&&((column.is_editable!==false&&column.is_editable!==0)||!column.is_unique))throw Error('เลขรันอัตโนมัติต้องอ่านอย่างเดียวและห้ามซ้ำ');}
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';

// Called inside writeRecord's IMMEDIATE transaction: allocation and row creation roll back together.
export function allocateAutoNumbers(database:Database.Database,table:string,columns:Column[],input:Record<string,unknown>){
 if(!database.inTransaction)throw Error('ต้องสร้างเลขรันภายใน Transaction');
 const generated:Record<string,string>={};
 for(const column of columns){const config=column.auto_number;if(!config)continue;
  if(input[column.name]!=null&&String(input[column.name]).trim()!=='')throw Error('กำหนดค่า "'+column.label+'" ไม่ได้: ระบบสร้างเลขรันให้เมื่อบันทึก');
  const prefixLength=Array.from(config.prefix).length,suffixLength=Array.from(config.suffix).length;
  const key=JSON.stringify([config.prefix,config.suffix]),saved=database.prepare('SELECT last_value,format_key FROM _auto_numbers WHERE table_name=? AND column_name=?').get(table,column.name) as {last_value:number;format_key:string}|undefined;
  let last=saved?.last_value||0;if(!Number.isSafeInteger(last)||last<0)throw Error('เลขลำดับที่จัดเก็บไม่ถูกต้อง');
  if(!saved||saved.format_key!==key){
   const field=quote(column.name),digits=`substr(${field},?+1,length(${field})-?-?)`;
   const existing=database.prepare(`SELECT MAX(CAST(${digits} AS INTEGER)) n FROM ${quote('t_'+table)} WHERE substr(${field},1,?)=? AND (?=0 OR substr(${field},-?)=?) AND length(${digits})>0 AND ${digits} NOT GLOB '*[^0-9]*'`).get(prefixLength,prefixLength,suffixLength,prefixLength,config.prefix,suffixLength,suffixLength,config.suffix,prefixLength,prefixLength,suffixLength,prefixLength,prefixLength,suffixLength) as {n:number|null};
   if(existing.n!=null&&(!Number.isSafeInteger(existing.n)||existing.n<0))throw Error('เลขรันเดิมเกินช่วงจำนวนเต็มที่รองรับ');last=Math.max(last,existing.n||0);
  }
  let next=Math.max(last+1,config.start);const exists=database.prepare('SELECT 1 FROM '+quote('t_'+table)+' WHERE '+quote(column.name)+'=?');
  for(let attempts=0;;attempts++,next++){
   if(!Number.isSafeInteger(next)||attempts>=1000)throw Error('ไม่สามารถสร้างเลขรันที่ไม่ซ้ำได้ กรุณาตรวจเลขเริ่มต้นและข้อมูลเดิม');
   const text=autoNumberText(config,next);if(exists.get(text))continue;
   generated[column.name]=text;database.prepare('INSERT INTO _auto_numbers(table_name,column_name,last_value,format_key) VALUES(?,?,?,?) ON CONFLICT(table_name,column_name) DO UPDATE SET last_value=excluded.last_value,format_key=excluded.format_key').run(table,column.name,next,key);break;
  }
 }
 return generated;
}
