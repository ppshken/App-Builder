import type Database from "better-sqlite3";
import {assertIdentifier,Column,normalizeValue,UNIQUE_TYPES} from "./columns";
export class UniqueValueError extends Error{
 readonly errors:Record<string,string>;
 constructor(column:Column,message:string){super(message);this.errors={[column.name]:message};}
}
export const uniqueErrorFields=(error:unknown)=>error instanceof UniqueValueError?error.errors:undefined;
export function assertUniqueColumn(column:Column){if(column.is_unique&&(column.is_virtual||!UNIQUE_TYPES.includes(column.type)))throw Error(`"${column.label}" ตั้งห้ามซ้ำได้เฉพาะช่องข้อมูลที่เก็บค่าเดียว กรุณาปิดห้ามซ้ำหรือคัดลอกไปคอลัมน์ใหม่`);}
const blank=(value:unknown)=>value==null||typeof value==="string"&&!value.trim();
// Match JavaScript trim(), including tabs, line breaks and Thai-facing Unicode whitespace.
export function uniqueNonBlankSql(name:string){assertIdentifier(name);return `"${name}" IS NOT NULL AND TRIM(CAST("${name}" AS TEXT),char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))<>''`;}
export function assertUniqueRow(database:Database.Database,table:string,columns:Column[],row:Record<string,unknown>,id?:number){
 assertIdentifier(table);
 for(const column of columns.filter(c=>!c.is_virtual&&(c.is_unique||c.is_key))){assertIdentifier(column.name);const value=normalizeValue(column,row[column.name]);if(blank(value))continue;
  const found=database.prepare(`SELECT id FROM "t_${table}" WHERE ${uniqueNonBlankSql(column.name)} AND "${column.name}"=? AND id<>? LIMIT 1`).get(value,id??-1) as {id:number}|undefined;
  if(found)throw new UniqueValueError(column,`${column.is_key?"Key":"ค่าในช่อง"} "${column.label}" ซ้ำกับแถว ${found.id} กรุณาใช้ค่าอื่น`);
 }
}
export type DuplicateGroup={value:unknown;count:number;ids:number[]};
export function duplicateGroups(database:Database.Database,table:string,column:Column,limit=20){
 assertIdentifier(table);assertIdentifier(column.name);if(column.is_virtual||!UNIQUE_TYPES.includes(column.type))throw Error("ตรวจค่าซ้ำได้เฉพาะช่องข้อมูลที่เก็บค่าเดียว");
 const groups=`SELECT "${column.name}" AS value,COUNT(*) AS count FROM "t_${table}" WHERE ${uniqueNonBlankSql(column.name)} GROUP BY "${column.name}" HAVING COUNT(*)>1`;
 const summary=database.prepare(`SELECT COUNT(*) AS groups,COALESCE(SUM(count),0) AS rows FROM (${groups})`).get() as {groups:number;rows:number};
 const query=database.prepare(`SELECT id FROM "t_${table}" WHERE "${column.name}"=? ORDER BY id LIMIT 20`);
 const duplicates=(database.prepare(`${groups} ORDER BY count DESC,value LIMIT ?`).all(limit) as {value:unknown;count:number}[]).map(group=>({...group,ids:(query.all(group.value) as {id:number}[]).map(row=>row.id)}));
 return {...summary,duplicates};
}
export function assertUniqueData(database:Database.Database,table:string,columns:Column[]){
 for(const column of columns.filter(c=>c.is_unique)){assertUniqueColumn(column);const result=duplicateGroups(database,table,column,1),group=result.duplicates[0];if(group){const value=String(group.value).slice(0,80);throw new UniqueValueError(column,`เปิดห้ามซ้ำให้ "${column.label}" ไม่ได้: ค่า "${value}" ซ้ำ ${group.count} รายการในแถว ${group.ids.slice(0,5).join(", ")}${group.count>5?" และแถวอื่น":""} กรุณาแก้ข้อมูลซ้ำก่อน`);}}
}
