import {createHash} from 'node:crypto';
import {AuthError} from './auth';
import type {Column} from './columns';
export function rowVersion(table:string,cols:Column[],row:Record<string,any>){return createHash('sha256').update(JSON.stringify([table,row.id,cols.filter(c=>!c.is_virtual).map(c=>[c.name,c.type,row[c.name]??null])])).digest('hex');}
export function assertRowVersion(table:string,cols:Column[],row:Record<string,any>|undefined,version:unknown){
if(version===undefined)return;
if(typeof version!=='string'||!/^[a-f0-9]{64}$/.test(version))throw new AuthError('รหัสตรวจสอบข้อมูลไม่ถูกต้อง กรุณาเปิดฟอร์มใหม่',409);
if(!row)throw new AuthError('รายการนี้ถูกลบแล้ว ข้อมูลที่กรอกยังอยู่ในฟอร์ม กรุณากลับไปตรวจรายการล่าสุด',409);
if(rowVersion(table,cols,row)!==version)throw new AuthError('ข้อมูลรายการนี้เปลี่ยนไปหลังจากเปิดฟอร์ม ระบบยังไม่ได้บันทึกทับ ข้อมูลที่กรอกยังอยู่ กรุณาตรวจข้อมูลล่าสุดก่อนแก้ไขใหม่',409);
}
