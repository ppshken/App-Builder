import type Database from "better-sqlite3";
import {db} from "./db";
import {AuthError} from "./auth";
import {AUDIT_CATEGORIES,AUDIT_OPERATIONS,type AuditEntry} from "./audit-display";
export function auditDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new AuthError("วันที่ต้องเป็นปี-เดือน-วัน เช่น 2026-10-09");const stamp=Date.parse(value+"T00:00:00+07:00");if(!Number.isFinite(stamp)||new Date(stamp+7*3600000).toISOString().slice(0,10)!==value)throw new AuthError("วันที่ไม่ถูกต้อง กรุณาเลือกวันที่มีอยู่จริง");return stamp;}
function integer(value:string|null,fallback:number,max:number){if(value===null)return fallback;if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>max)throw new AuthError("จำนวนรายการหรือหน้าที่เลือกไม่ถูกต้อง");return Number(value);}
function decode(row:Record<string,any>){const {changes_json,...entry}=row;return {...entry,changes:JSON.parse(changes_json)} as AuditEntry;}
export function readAuditLog(params:URLSearchParams,database:Database.Database=db){const id=params.get("id");if(id){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new AuthError("รหัสประวัติไม่ถูกต้อง");const row=database.prepare("SELECT * FROM _audit_log WHERE event_id=?").get(id) as any;if(!row)throw new AuthError("ไม่พบรายการประวัตินี้",404);return decode(row);}
if(params.get("options")==="1")return {actors:database.prepare("SELECT actor_email AS email,actor_name AS name,MAX(occurred_at) AS last_seen FROM _audit_log GROUP BY actor_email ORDER BY last_seen DESC LIMIT 500").all()};
const clauses:string[]=[],values:(string|number)[]=[],q=(params.get("q")||"").trim(),category=params.get("category")||"",actor=params.get("actor")||"",operation=params.get("operation")||"",from=params.get("from")||"",to=params.get("to")||"";
if(q.length>300)throw new AuthError("ข้อความค้นหาต้องไม่เกิน 300 ตัวอักษร");if(actor.length>254)throw new AuthError("อีเมลผู้แก้ไขยาวเกินไป");
if(q){clauses.push("(entity_label LIKE ? ESCAPE '\\' OR actor_name LIKE ? ESCAPE '\\' OR actor_email LIKE ? ESCAPE '\\' OR changes_json LIKE ? ESCAPE '\\')");const pattern="%"+q.replace(/[\\%_]/g,c=>"\\"+c)+"%";values.push(pattern,pattern,pattern,pattern);}
if(category){if(!Object.hasOwn(AUDIT_CATEGORIES,category))throw new AuthError("หมวดประวัติไม่ถูกต้อง");clauses.push("category=?");values.push(category);}
if(operation){if(!Object.hasOwn(AUDIT_OPERATIONS,operation))throw new AuthError("การทำรายการไม่ถูกต้อง");clauses.push("operation=?");values.push(operation);}
if(actor){clauses.push("actor_email=?");values.push(actor);}
const start=from?auditDate(from):undefined,end=to?auditDate(to)+86400000:undefined;
if(start!==undefined&&end!==undefined&&start>=end)throw new AuthError("วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด");if(start!==undefined){clauses.push("occurred_at>=?");values.push(start);}if(end!==undefined){clauses.push("occurred_at<?");values.push(end);}
const requested=integer(params.get("page"),1,1000000000),size=integer(params.get("page_size"),20,100),where=clauses.length?" WHERE "+clauses.join(" AND "):"",total=(database.prepare("SELECT COUNT(*) AS n FROM _audit_log"+where).get(...values) as {n:number}).n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
const rows=database.prepare("SELECT event_id,request_id,occurred_at,actor_id,actor_name,actor_email,actor_role,category,entity_type,entity_key,entity_label,operation,source,json_array_length(changes_json) AS changed_fields FROM _audit_log"+where+" ORDER BY occurred_at DESC,rowid DESC LIMIT ? OFFSET ?").all(...values,size,(page-1)*size);
return {rows,total,page,pages,page_size:size};}
