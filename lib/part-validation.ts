import {InvalidValueError} from './invalid-value-error';
import {refTablesOf,type Column} from './columns';
import {asBoolean,evaluateExpression} from './expression';
/** Shared by normal parent saves and publication validation. Never writes records. */
export function assertPartValues(link:Column,table:string,ids:(number|string)[],row:Record<string,unknown>,cols:Column[],context:Parameters<typeof evaluateExpression>[2],email:string){
 if(link.related_required&&!ids.length)throw Error('รายการที่เกี่ยวข้อง '+table+' · '+link.label+' ต้องมีข้อมูลอย่างน้อย 1 รายการก่อนบันทึก');
 if(link.is_part_of&&link.part_valid_if?.trim()&&!asBoolean(evaluateExpression(link.part_valid_if,{...row,_THIS:ids.map(String)},{...context,refTables:refTablesOf(cols),userEmail:email})))throw link.part_invalid_value_error?.trim()?new InvalidValueError(link.part_invalid_value_error.trim()):new Error('รายการลูก '+table+' ไม่ผ่าน Valid_If กรุณาตรวจจำนวนรายการหรือเงื่อนไขที่กำหนด');
}
