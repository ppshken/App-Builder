import {formulaErrors,type FormulaSchema} from './columns';
import {evaluateExpression,references,type ExpressionOptions} from './expression';
export function validateViewDisplayName(source:unknown,schema?:FormulaSchema){
 if(typeof source!=='string'||source.length>10000)throw Error('Display Name ต้องเป็นสูตรข้อความไม่เกิน 10,000 ตัวอักษร');const text=source.trim();if(!text)return '';
 if(references(text).length)throw Error('Display Name ของ View ไม่มีแถวปัจจุบัน ใช้ข้อมูลผู้ใช้หรือสูตรข้ามตารางแทน [คอลัมน์]');
 const error=formulaErrors([{name:'view_title',label:'Display Name',type:'text',default_expr:text}],schema)['view_title.default_expr'];if(error)throw Error(error);return text;
}
export function displayNameValue(source:string,context:ExpressionOptions={}){
 const result=evaluateExpression(source,{},context);if(result===null)return '';if(typeof result!=='string'&&typeof result!=='number')throw Error('Display Name ต้องคืนข้อความหรือตัวเลข');if(typeof result==='number'&&!Number.isFinite(result))throw Error('Display Name ต้องเป็นค่าที่ถูกต้อง');const text=String(result).trim();if(text.length>100)throw Error('ผลลัพธ์ Display Name ต้องไม่เกิน 100 ตัวอักษร');return text;
}
