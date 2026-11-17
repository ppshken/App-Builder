import type Database from 'better-sqlite3';
import type {AuthUser} from './auth';
import {auditDate} from './audit-log';
import {AsyncLocalStorage} from 'node:async_hooks';
type UsageContext={started:number;request:unknown;writes:{statement:Database.Statement;id:number|bigint}[]};
const globalScope=globalThis as typeof globalThis&{__usageRequestScope?:AsyncLocalStorage<UsageContext>};
const usageScope=globalScope.__usageRequestScope??=new AsyncLocalStorage<UsageContext>();
const lastPrune=new WeakMap<Database.Database,number>();
export function recordAppUsage(db:Database.Database,actor:Pick<AuthUser,'id'|'name'>,appId:string|null,event:string,target:string,status=200,errorDetail:unknown="",details?:{request?:unknown;durationMs?:number}){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_app_usage'").get())return;
 const now=Date.now(),days=Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180));if((lastPrune.get(db)||0)<now-3600000){db.prepare('DELETE FROM _app_usage WHERE id IN (SELECT id FROM _app_usage WHERE occurred_at<? ORDER BY occurred_at LIMIT 5000)').run(now-days*86400000);lastPrune.set(db,now);}
 const context=usageScope.getStore(),elapsed=details?.durationMs??(context?performance.now()-context.started:undefined),request=details&&Object.hasOwn(details,'request')?details.request:context?.request;
 const inserted=db.prepare('INSERT INTO _app_usage(app_id,actor_id,actor_name,event,target,status,occurred_at,error_detail,request_json,duration_ms) VALUES(?,?,?,?,?,?,?,?,?,?)').run(appId,actor.id,actor.name,event,target.slice(0,240),status,Date.now(),status>=400?sanitizeUsageError(errorDetail):"",request===undefined?'':sanitizeUsageRequest(request),elapsed!==undefined&&Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed*100)/100:null);
 // Prepare inside the current DB scope: a draft proxy must never resolve to live DB later.
 if(context&&details?.durationMs===undefined)context.writes.push({statement:db.prepare('UPDATE _app_usage SET duration_ms=? WHERE id=?'),id:inserted.lastInsertRowid});
}
export function readAppUsage(db:Database.Database,params:URLSearchParams){
 const clauses:string[]=[],values:(string|number)[]=[];
 for(const [param,column] of [['app','app_id'],['user','actor_id'],['event','event']] as const){const v=params.get(param);if(v){clauses.push(column+'=?');values.push(v);}}
 for(const [param,op] of [['from','>='],['to','<']] as const){const v=params.get(param);if(!v)continue;const stamp=auditDate(v);clauses.push('occurred_at'+op+'?');values.push(stamp+(param==='to'?86400000:0));}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'',total=(db.prepare('SELECT COUNT(*) n FROM _app_usage'+where).get(...values) as {n:number}).n;
 const page=Math.min(Math.max(1,Math.floor(Number(params.get('page'))||1)),Math.max(1,Math.ceil(total/30)));
 return {actors:db.prepare('SELECT actor_id id,MAX(actor_name) name FROM _app_usage GROUP BY actor_id ORDER BY name LIMIT 1000').all(),retention_days:Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180)),rows:db.prepare('SELECT * FROM _app_usage'+where+' ORDER BY occurred_at DESC,id DESC LIMIT 30 OFFSET ?').all(...values,(page-1)*30),total,page,pages:Math.max(1,Math.ceil(total/30))};
}

/** Error details never include stack traces; request bodies have separate redaction. */
export function sanitizeUsageError(value:unknown):string{
 if(typeof value!=='string')return '';
 return value.split(/\n\s*at\s/)[0].replace(/Bearer\s+[^\s,;]+/gi,'Bearer [redacted]').replace(/((?:password|passwd|token|secret|authorization|cookie|api[_-]?key)["']?\s*[=:]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,'$1[redacted]').replace(/https?:\/\/[^\s<>]+/gi,'[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,2000);
}
export async function usageResponseError(response:Response):Promise<string>{
 if(response.status<400)return '';
 const fallback='HTTP '+response.status;
 if(!response.headers.get('content-type')?.includes('application/json'))return fallback;
 const copy=response.clone(),reader=copy.body?.getReader();if(!reader)return fallback;
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){void reader.cancel().catch(()=>{});return fallback;}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const data=JSON.parse(new TextDecoder().decode(bytes));return sanitizeUsageError(data.error)||fallback;}catch{return fallback;}finally{reader.releaseLock();}
}

export function sanitizeUsageRequest(input:unknown):string{
 let nodes=0;const seen=new WeakSet<object>();
 const privateKey=/(password|passwd|passphrase|token|secret|authorization|cookie|api.?key|credential|private.?key|email|e.?mail|phone|mobile|national.?id|id.?card|signature|base64|binary|sql)/i;
 function clean(value:unknown,depth=0,key=''):unknown{
  if(privateKey.test(key))return '[ซ่อนข้อมูล]';if(++nodes>400||depth>6)return '[ตัดข้อมูลเกินขอบเขต]';
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string'){
   if(/^data:|^-----BEGIN |^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(value))return '[ซ่อนข้อมูลไฟล์หรือโทเคน]';
   let text=value.replace(/Bearer\s+[^\s,;]+/gi,'Bearer [ซ่อนข้อมูล]').replace(/((?:password|token|secret|api[_-]?key)["']?\s*[=:]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,'$1[ซ่อนข้อมูล]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[ซ่อนอีเมล]');
   text=text.replace(/https?:\/\/[^\s<>]+/gi,url=>{try{const parsed=new URL(url);parsed.username='';parsed.password='';for(const key of [...parsed.searchParams.keys()])if(privateKey.test(key)||/^(sig|auth|key)$/i.test(key))parsed.searchParams.set(key,'[ซ่อนข้อมูล]');parsed.hash='';return parsed.toString();}catch{return '[URL]';}});
   if(/^[A-Za-z0-9+/=]{200,}$/.test(text))return '[ซ่อนข้อมูลเข้ารหัสขนาดใหญ่]';return text.length>512?text.slice(0,512)+'… [ตัดข้อความ]':text;
  }
  if(typeof value!=='object')return '[ชนิดข้อมูลที่ไม่เก็บ]';if(Buffer.isBuffer(value))return '[ซ่อนข้อมูลไฟล์]';if(seen.has(value))return '[ข้อมูลวนซ้ำ]';seen.add(value);
  if(Array.isArray(value))return value.slice(0,20).map(item=>clean(item,depth+1,key)).concat(value.length>20?['[ตัดรายการเพิ่มเติม]']:[]);
  const output:Record<string,unknown>=Object.create(null);for(const [name,entry]of Object.entries(value as Record<string,unknown>).slice(0,50))output[name.slice(0,100)]=clean(entry,depth+1,name);return output;
 }
 const result=JSON.stringify(clean(input));return Buffer.byteLength(result)>8192?JSON.stringify({_omitted:'คำขอมีขนาดเกิน 8 KB หลังปิดบังข้อมูล จึงไม่เก็บเนื้อหา'}):result;
}
export async function usageRequest(req:Request):Promise<{method:string;query:Record<string,string>;body:unknown}>{
 const query=Object.fromEntries([...new URL(req.url).searchParams].slice(0,50));let body:unknown=null;
 if(!['GET','HEAD'].includes(req.method)){
  if(!req.headers.get('content-type')?.toLowerCase().includes('application/json'))body={_omitted:'ไม่เก็บเนื้อหาไฟล์หรือคำขอที่ไม่ใช่ JSON'};
  else if(Number(req.headers.get('content-length'))>32768)body={_omitted:'คำขอ JSON เกิน 32 KB'};
  else{const reader=req.clone().body?.getReader();if(reader){const chunks:Uint8Array[]=[];let length=0,timer:ReturnType<typeof setTimeout>|undefined;try{const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),200);});while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;length+=part.value.byteLength;if(length>32768)throw Error('size');chunks.push(part.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=length?JSON.parse(new TextDecoder().decode(bytes)):null;}catch{body={_omitted:'ไม่ได้เก็บ JSON เนื่องจากขนาด รูปแบบ หรือเวลาอ่านข้อมูล'};void reader.cancel().catch(()=>{});}finally{if(timer)clearTimeout(timer);reader.releaseLock();}}}
 }
 return JSON.parse(sanitizeUsageRequest({method:req.method,query,body}));
}
export async function withUsageRequest<T>(req:Request,work:()=>Promise<T>):Promise<T>{
 const started=performance.now();let request:unknown;try{request=await usageRequest(req);}catch{request={method:req.method,body:{_omitted:'ไม่สามารถเก็บรายละเอียดคำขอได้'}};}
 const context:UsageContext={started,request,writes:[]};
 return usageScope.run(context,async()=>{try{return await work();}finally{const elapsed=Math.round((performance.now()-context.started)*100)/100;for(const {statement,id}of context.writes)try{statement.run(elapsed,id);}catch{ /* Logging must not alter the operation result. */ }}});
}
