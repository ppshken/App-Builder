import {randomUUID} from 'node:crypto';
import {db} from './db';
import {currentApplication} from './application-context';
import {currentAccess} from './permissions';
import {ExternalDataError,normalizeExternalConnection,resolveJsonPath,detectExternalSchema,redactExternalPreview,type ExternalConnection} from './external-data-config';
import {requestExternalJson,validateExternalUrl,externalOrigins} from './external-http';
export function consumeExternalBudget(app:string,source='preview'){
 const now=Date.now();db.transaction(()=>{for(const [scope,limit] of [['app:'+app,120],['source:'+app+':'+source,40]] as const){const row=db.prepare('SELECT * FROM _external_limits WHERE scope=?').get(scope) as {window_at:number;count:number}|undefined;if(row&&row.window_at>now-60000&&row.count>=limit)throw new ExternalDataError('เรียก External API ถี่เกินไป กรุณารอหนึ่งนาที',429);db.prepare('INSERT INTO _external_limits(scope,window_at,count) VALUES(?,?,1) ON CONFLICT(scope) DO UPDATE SET window_at=excluded.window_at,count=?').run(scope,row&&row.window_at>now-60000?row.window_at:now,row&&row.window_at>now-60000?row.count+1:1);}db.prepare('DELETE FROM _external_limits WHERE window_at<?').run(now-3600000);}).immediate();
}
export function connectionUrl(connection:ExternalConnection){let base:URL;try{base=new URL(connection.base_url);}catch{throw new ExternalDataError('Base URL ไม่ถูกต้อง');}if(base.pathname!=='/'||base.search||base.hash)throw new ExternalDataError('Base URL ต้องเป็น Origin เท่านั้น เช่น https://api.example.com');const url=new URL(connection.endpoint,base);for(const [key,value] of Object.entries(connection.query))url.searchParams.set(key,value);return url;}
export async function previewExternalConnection(raw:unknown){if(!currentAccess().builder)throw new ExternalDataError('เฉพาะผู้พัฒนาแอป',403);const connection=normalizeExternalConnection(raw),app=currentApplication()?.id||'default',url=connectionUrl(connection);const result=await requestExternalJson(url.href,connection,app,()=>consumeExternalBudget(app));const data=resolveJsonPath(result.data,connection.data_path),records=Array.isArray(data)?data:[];return {status:result.status,duration_ms:result.duration_ms,bytes:result.bytes,record_count:records.length,sample:redactExternalPreview(result.data,result.secrets),schema:detectExternalSchema(records),notice:'Preview แสดงตัวอย่างไม่เกิน 10 รายการ ข้อมูลลับและข้อมูลส่วนบุคคลบางช่องถูกปิดบัง'};}
export async function collectExternalRecords(connection:ExternalConnection,sourceId:string,app:string,checkpoint=''){
 const start=Date.now(),initial=connectionUrl(connection),records:unknown[]=[],seen=new Set<string>();let next=initial,cursor:unknown,bytes=0,complete=false;
 for(let page=0;page<connection.max_pages;page++){
  if(Date.now()-start>=60000)throw new ExternalDataError('ดึงข้อมูลรวมเกิน 60 วินาที');
  const p=connection.pagination;if(p.kind==='page')next.searchParams.set(p.parameter,String(p.start+page));if(p.kind==='offset')next.searchParams.set(p.parameter,String(p.start+page*p.size));if(p.kind==='cursor'&&cursor!=null)next.searchParams.set(p.parameter,String(cursor));if(p.kind!=='none'&&p.kind!=='next')next.searchParams.set(p.size_parameter,String(p.size));
  const signature=next.href;if(seen.has(signature))throw new ExternalDataError('Pagination วนซ้ำ');seen.add(signature);
  const response=await requestExternalJson(next.href,{...connection,timeout_ms:Math.min(connection.timeout_ms,Math.max(1000,60000-(Date.now()-start)))},app,()=>consumeExternalBudget(app,sourceId));bytes+=response.bytes;if(bytes>10*1024*1024)throw new ExternalDataError('ข้อมูลรวมเกิน 10 MB');const data=resolveJsonPath(response.data,connection.data_path);if(!Array.isArray(data))throw new ExternalDataError('Response Data Path ต้องชี้ไปยัง Array');
  if(records.length+data.length>connection.max_records)throw new ExternalDataError('จำนวนรายการเกินเพดาน กรุณาเพิ่ม Max Records หรือกรองจากต้นทาง');records.push(...data);
  if(p.kind==='none'||!data.length){complete=true;break;}
  if(['page','offset'].includes(p.kind)){if(data.length<p.size){complete=true;break;}next=new URL(initial);continue;}
  const value=resolveJsonPath(response.data,p.next_path);if(value==null||value===''){complete=true;break;}if(typeof value!=='string'&&typeof value!=='number')throw new ExternalDataError('Cursor / Next Link ต้องเป็นข้อความหรือตัวเลข');
  if(p.kind==='next'){next=validateExternalUrl(new URL(String(value),next).href,externalOrigins(app));if(next.origin!==initial.origin)throw new ExternalDataError('Next Link ห้ามข้าม Origin');}else{cursor=value;next=new URL(initial);}
 }
 if(!complete)throw new ExternalDataError('Pagination ยังไม่ครบภายใน Max Pages กรุณาปรับเพดานหรือกรองข้อมูล');return {records,bytes,duration_ms:Date.now()-start,complete};
}
export function acquireExternalLease(sourceId:string){const token=randomUUID(),now=Date.now();const ok=db.prepare('INSERT INTO _external_leases(source_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(source_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE _external_leases.expires_at<?').run(sourceId,token,now+90000,now).changes;if(!ok)throw new ExternalDataError('Data Source นี้กำลังดึงหรือซิงค์ข้อมูล กรุณารอสักครู่',409);return ()=>db.prepare('DELETE FROM _external_leases WHERE source_id=? AND token=?').run(sourceId,token);}
