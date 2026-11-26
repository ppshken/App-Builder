import {createHash} from 'node:crypto';
import {db} from './db';
import {BULK_ACTION_SCHEMA} from './bulk-action-schema';
import {FORM_SUBMISSION_SCHEMA} from './form-submission-schema';
import {currentApplication} from './application-context';
import {currentDevelopment} from './development-context';
import {currentUser,assertTablePermission} from './permissions';
import {AuthError} from './auth';
import type {FormImageUpload} from './form-images';
export const FORM_SUBMISSION_TTL=24*60*60*1000;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
function scope(email:string){const user=currentUser();if(!user)throw new AuthError('กรุณาเข้าสู่ระบบก่อนบันทึก',401);return hash([currentApplication()?.id||'default',currentDevelopment()?.id||'',user.id,email]);}
export function formSubmissionContext(email=''){
 const boundary=scope(email);
 if(currentDevelopment()){
  const hasTable=db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?");
  if(!hasTable.get('_bulk_action_state')||!db.prepare('SELECT 1 FROM _bulk_action_state WHERE id=1').get())db.exec(BULK_ACTION_SCHEMA);
  if(!hasTable.get('_form_submissions'))db.exec(FORM_SUBMISSION_SCHEMA);
 }
 const epoch=(db.prepare('SELECT epoch FROM _bulk_action_state WHERE id=1').get() as {epoch:string}).epoch;
 return epoch+'.'+boundary+'.'+Date.now();
}
/** Called inside the same immediate transaction as rows, children, files and saved Actions. */
export function formSubmission<T>(table:string,view:string|null,email:string,values:Record<string,any>,images:FormImageUpload[],key:string|undefined,work:()=>T):T{
 if(!key)return work();
 if(!db.inTransaction)throw Error('การบันทึกฟอร์มต้องอยู่ในธุรกรรม');
 assertTablePermission(table,'read');assertTablePermission(table,'create');
 if(!/^[a-f0-9]{32}\.[a-f0-9]{64}\.\d{13}\.[a-f0-9-]{36}$/.test(key))throw new AuthError('รหัสคำขอบันทึกไม่ถูกต้อง กรุณาเปิดฟอร์มใหม่',400);
 const [epoch,boundary,issued]=key.split('.'),current=formSubmissionContext(email).split('.'),now=Date.now(),started=Number(issued);
 if(epoch!==current[0]||boundary!==current[1])throw new AuthError('บริบทข้อมูลหรือผู้ใช้งานเปลี่ยน กรุณาเปิดฟอร์มใหม่ก่อนบันทึก',409);
 if(started>now+300000||started<now-FORM_SUBMISSION_TTL)throw new AuthError('ฟอร์มนี้หมดอายุแล้ว กรุณาตรวจรายการล่าสุดแล้วเปิดฟอร์มใหม่',409);
 const requestHash=hash(canonical({table,view,email,values,images:images.map(i=>({token:i.token,table:i.table,column:i.column,name:i.originalName||'',digest:createHash('sha256').update(i.bytes).digest('hex')})).sort((a,b)=>a.token.localeCompare(b.token))}));
 const receipt=db.prepare('SELECT request_hash,result_json FROM _form_submissions WHERE scope_hash=? AND request_key=?').get(boundary,key) as {request_hash:string;result_json:string}|undefined;
 if(receipt){if(receipt.request_hash!==requestHash)throw new AuthError('คำขอนี้บันทึกไปแล้วแต่ข้อมูลในฟอร์มเปลี่ยน กรุณาตรวจรายการล่าสุดก่อนเพิ่มใหม่',409);return JSON.parse(receipt.result_json) as T;}
 db.prepare('DELETE FROM _form_submissions WHERE expires_at<?').run(now);
 const result=work(),json=JSON.stringify(result);
 db.prepare('INSERT INTO _form_submissions(scope_hash,request_key,request_hash,result_json,expires_at) VALUES(?,?,?,?,?)').run(boundary,key,requestHash,json,started+FORM_SUBMISSION_TTL);
 return result;
}
