import {db,tableExists} from './db';
import {AuthError} from './auth';
import {assertTablePermission,currentUser} from './permissions';
import {asBoolean,evaluateExpression,references,userSettingReferences} from './expression';
import {expressionContext} from './expression-context';

export const DEFAULT_CREATE_ERROR='ยังเพิ่มรายการใหม่ไม่ได้ กรุณาทำรายการก่อนหน้าให้เสร็จก่อน';
export function validateCreateGuard(source:unknown,message:unknown){
 if(typeof source!=='string'||source.length>4000||typeof message!=='string'||message.length>500)throw Error('เงื่อนไขไม่เกิน 4,000 ตัวอักษร และข้อความไม่เกิน 500 ตัวอักษร');
 if(source.trim()){
  if(references(source).length)throw Error('เงื่อนไขเพิ่มข้อมูลตรวจตอนยังไม่มีแถว ใช้ข้อมูลบัญชีและ SELECT(ตาราง[คอลัมน์], เงื่อนไข) แทนคอลัมน์ของแถวใหม่');
  if(userSettingReferences(source).length)throw Error('เงื่อนไขเพิ่มข้อมูลไม่ใช้ USERSETTINGS เพราะผู้ใช้เปลี่ยนค่าเองได้');
 }
 return {create_if:source.trim(),create_error:message.trim()};
}
export function tableCreateEligibility(table:string):{allowed:boolean;message:string}{
 if(!tableExists(table))throw new AuthError('ไม่พบตาราง',404);
 assertTablePermission(table,'read');assertTablePermission(table,'create');
 const rule=db.prepare('SELECT create_if,create_error FROM _tables WHERE name=?').get(table) as {create_if:string;create_error:string};
 if(!rule.create_if.trim())return {allowed:true,message:''};
 try{
  validateCreateGuard(rule.create_if,rule.create_error);
  const now=new Date(),email=currentUser()?.email||'';
  const allowed=asBoolean(evaluateExpression(rule.create_if,{}, {...expressionContext(now,email),tableName:table,userEmail:email}));
  return {allowed,message:allowed?'':rule.create_error||DEFAULT_CREATE_ERROR};
 }catch{return {allowed:false,message:'ตรวจเงื่อนไขเพิ่มข้อมูลไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ'};}
}
export function assertTableCreateAllowed(table:string){const result=tableCreateEligibility(table);if(!result.allowed)throw new AuthError(result.message,422);}
