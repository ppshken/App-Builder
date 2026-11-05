import type Database from 'better-sqlite3';
import type {AuthUser} from './auth';
import {auditDate} from './audit-log';
const lastPrune=new WeakMap<Database.Database,number>();
export function recordAppUsage(db:Database.Database,actor:Pick<AuthUser,'id'|'name'>,appId:string|null,event:string,target:string,status=200,errorDetail:unknown=""){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_app_usage'").get())return;
 const now=Date.now(),days=Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180));if((lastPrune.get(db)||0)<now-3600000){db.prepare('DELETE FROM _app_usage WHERE id IN (SELECT id FROM _app_usage WHERE occurred_at<? ORDER BY occurred_at LIMIT 5000)').run(now-days*86400000);lastPrune.set(db,now);}
 db.prepare('INSERT INTO _app_usage(app_id,actor_id,actor_name,event,target,status,occurred_at,error_detail) VALUES(?,?,?,?,?,?,?,?)').run(appId,actor.id,actor.name,event,target.slice(0,240),status,Date.now(),status>=400?sanitizeUsageError(errorDetail):"");
}
export function readAppUsage(db:Database.Database,params:URLSearchParams){
 const clauses:string[]=[],values:(string|number)[]=[];
 for(const [param,column] of [['app','app_id'],['user','actor_id'],['event','event']] as const){const v=params.get(param);if(v){clauses.push(column+'=?');values.push(v);}}
 for(const [param,op] of [['from','>='],['to','<']] as const){const v=params.get(param);if(!v)continue;const stamp=auditDate(v);clauses.push('occurred_at'+op+'?');values.push(stamp+(param==='to'?86400000:0));}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'',total=(db.prepare('SELECT COUNT(*) n FROM _app_usage'+where).get(...values) as {n:number}).n;
 const page=Math.min(Math.max(1,Math.floor(Number(params.get('page'))||1)),Math.max(1,Math.ceil(total/30)));
 return {actors:db.prepare('SELECT actor_id id,MAX(actor_name) name FROM _app_usage GROUP BY actor_id ORDER BY name LIMIT 1000').all(),retention_days:Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180)),rows:db.prepare('SELECT * FROM _app_usage'+where+' ORDER BY occurred_at DESC,id DESC LIMIT 30 OFFSET ?').all(...values,(page-1)*30),total,page,pages:Math.max(1,Math.ceil(total/30))};
}

/** Store only the public error message, never request payloads or stack traces. */
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
