import {customActions} from '@/lib/custom-page';
import {pruneApplicationActionGrants} from '@/lib/application-role-grants';
import {validateStoredWorkflows} from "@/lib/workflow-validation";
import {ACTION_KINDS,appearance} from "@/lib/action-config";
import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import {uniqueErrorFields} from "@/lib/unique";
import { NextResponse } from "next/server";
import { db, columnsOf, tableExists } from "@/lib/db";
import { assertIdentifier } from "@/lib/columns";
import { actions, checkFormula, executeAction } from "@/lib/automation";
import { bad, errorMessage, readBody } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handleGET() { try { return NextResponse.json(actions()); } catch(e) { return bad(errorMessage(e),errorStatus(e),uniqueErrorFields(e)); } }
async function handlePOST(req: Request) {
  try {
    const b = await readBody(req);
    if (b.op === "execute") {
      const email = req.headers.get("x-nocode-preview-email") || "";
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("อีเมลสำหรับ Preview ไม่ถูกต้อง");
      return NextResponse.json(executeAction(b.name, b.id, email.toLowerCase(), b.slice_name || null));
    }
    return save(b, false);
  } catch(e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePUT(req: Request) { try { return save(await readBody(req), true); } catch(e) { return bad(errorMessage(e),errorStatus(e)); } }
function save(b: Record<string, any>, existing: boolean) {
  assertIdentifier(b.name);
  if (!tableExists(b.table_name)) throw new Error("กรุณาเลือกตาราง");
  if (typeof b.label !== "string" || !b.label.trim()) throw new Error("กรุณาตั้งชื่อ Action");
  if (!Object.hasOwn(ACTION_KINDS,b.kind)) throw new Error("ชนิด Action ไม่ถูกต้อง");
  const condition = checkFormula(b.table_name, b.condition_expr);
  if (!b.values || typeof b.values !== "object" || Array.isArray(b.values)) throw new Error("ค่าของ Action ไม่ถูกต้อง");
  const cols = columnsOf(b.table_name), values: Record<string, string> = {};
  if (["set","copy","add"].includes(b.kind)) {
    if (b.kind==="set"&&!Object.keys(b.values).length) throw new Error("เลือกอย่างน้อยหนึ่งคอลัมน์และกรอกสูตรค่าใหม่");
    for (const [name, expr] of Object.entries(b.values)) {
      if (!cols.some(c => c.name === name && !c.is_virtual)) throw new Error("เปลี่ยนช่องคำนวณหรือรหัสภายในด้วย Action ไม่ได้");
      values[name] = checkFormula(b.table_name, expr);
    }
  }
  if (typeof b.confirmation !== "string" || b.confirmation.length > 1000) throw new Error("ข้อความยืนยันต้องไม่เกิน 1,000 ตัวอักษร");
  if (existing && !db.prepare("SELECT 1 FROM _actions WHERE name=?").get(b.name)) return bad("ไม่พบ Action",404);
  const used = db.prepare("SELECT label,table_name,display_json FROM _views").all() as {label:string;table_name:string;display_json:string}[];
  if (used.some(v => { const d=JSON.parse(v.display_json); return (d.row_click === "action" && d.row_action === b.name||d.form_saved_action===b.name) && v.table_name !== b.table_name; })) throw new Error("Action นี้ถูกใช้เมื่อคลิกแถวใน View กรุณายกเลิกการใช้งานก่อนเปลี่ยนตาราง");
  if(existing){const old=db.prepare("SELECT table_name FROM _actions WHERE name=?").get(b.name) as {table_name:string};if(old.table_name!==b.table_name&&used.some(v=>customActions(JSON.parse(v.display_json).custom_page).includes(b.name)))throw Error("Action นี้ใช้ในหน้ากำหนดเอง กรุณานำออกก่อนเปลี่ยนตาราง");}
  const config=b.config||{};if(!config||typeof config!=="object"||Array.isArray(config))throw Error("การตั้งค่า Action ไม่ถูกต้อง");
  const safeConfig:Record<string,any>={};if(b.kind==="set"&&config.value_mode!==undefined){if(!["snapshot","sequential"].includes(config.value_mode))throw Error("รูปแบบลำดับคำนวณไม่ถูกต้อง");safeConfig.value_mode=config.value_mode;}if(b.kind==="automation"){const workflow=db.prepare("SELECT table_name,event,enabled FROM _automations WHERE name=?").get(config.automation_name) as any;if(!workflow||workflow.table_name!==b.table_name||workflow.event!=="manual"||!workflow.enabled)throw Error("เลือก Automation แบบกดปุ่มของตารางนี้ที่เปิดใช้งานอยู่");safeConfig.automation_name=config.automation_name;}if(["open_url","call","sms","email"].includes(b.kind))safeConfig.url_expr=checkFormula(b.table_name,config.url_expr);if(["open_view","edit_form","new_form","open_detail"].includes(b.kind)){if(typeof config.view_name!=="string"||!db.prepare("SELECT 1 FROM _views WHERE name=? AND position<>'inline'").get(config.view_name))throw Error("กรุณาเลือก View ที่มีอยู่");const view=db.prepare("SELECT * FROM _views WHERE name=?").get(config.view_name) as any;if(b.kind==="open_detail"?view.kind!=="detail":b.kind!=="open_view"&&(view.kind!=="form"||b.kind==="edit_form"&&view.table_name!==b.table_name))throw Error("เลือก View แบบฟอร์ม โดยฟอร์มแก้ไขต้องอยู่ในตารางเดียวกัน");safeConfig.view_name=config.view_name;if(b.kind==="open_detail")safeConfig.row_expr=checkFormula(b.table_name,config.row_expr);if(b.kind==="new_form"){const initial=config.initial_values||{};if(!initial||typeof initial!=="object"||Array.isArray(initial))throw Error("ค่าตั้งต้นของฟอร์มไม่ถูกต้อง");const targetCols=columnsOf(view.table_name);safeConfig.initial_values={};for(const [name,expr] of Object.entries(initial)){if(!targetCols.some(c=>c.name===name&&!c.is_virtual&&c.is_editable!==false&&c.is_editable!==0))throw Error("ค่าตั้งต้นต้องเลือกคอลัมน์ที่แก้ไขได้ในตารางปลายทาง");safeConfig.initial_values[name]=checkFormula(b.table_name,expr);}}}
  if(b.kind==="grouped"){if(!Array.isArray(config.actions)||config.actions.length<1||config.actions.length>10||new Set(config.actions).size!==config.actions.length)throw Error("เลือก Action ไม่ซ้ำกัน 1–10 รายการ");for(let i=0;i<config.actions.length;i++){const child=db.prepare("SELECT * FROM _actions WHERE name=?").get(config.actions[i]) as any;if(!child||child.name===b.name||child.table_name!==b.table_name||!["set","add","copy","delete"].includes(child.kind)||child.kind==="delete"&&i!==config.actions.length-1)throw Error("Action ย่อยต้องแก้ไข/เพิ่ม/คัดลอกข้อมูลในตารางเดียวกัน ลบได้เฉพาะขั้นตอนสุดท้าย");}safeConfig.actions=config.actions;}
  const parents=db.prepare("SELECT name,label,config_json FROM _actions WHERE kind='grouped' AND name<>?").all(b.name) as any[];for(const parent of parents){const steps=JSON.parse(parent.config_json).actions||[];if(steps.includes(b.name)&&(!["set","add","copy","delete"].includes(b.kind)||b.kind==="delete"&&steps.indexOf(b.name)!==steps.length-1||(db.prepare("SELECT table_name FROM _actions WHERE name=?").get(parent.name) as any).table_name!==b.table_name))throw Error('Action นี้ใช้ในชุด "'+parent.label+'" กรุณานำออกจากชุดก่อนเปลี่ยนชนิดหรือตาราง');}
  const look=appearance(b.appearance||{},b.kind);
  const args = [JSON.stringify(safeConfig),JSON.stringify(look),b.label.trim(), b.table_name, b.kind, condition, JSON.stringify(values), b.confirmation.trim(), b.name];
  db.transaction(()=>{db.prepare(existing ? "UPDATE _actions SET config_json=?,appearance_json=?,label=?,table_name=?,kind=?,condition_expr=?,values_json=?,confirmation=? WHERE name=?" : "INSERT INTO _actions(config_json,appearance_json,label,table_name,kind,condition_expr,values_json,confirmation,name) VALUES(?,?,?,?,?,?,?,?,?)").run(...args);validateStoredWorkflows(db);})();
  return NextResponse.json({ ok: true });
}
async function handleDELETE(req: Request) { try { const name = new URL(req.url).searchParams.get("name"); assertIdentifier(name);if((db.prepare("SELECT config_json FROM _automations").all() as {config_json:string}[]).some(w=>JSON.parse(w.config_json).steps.some((s:any)=>s.kind==="action"&&s.action_name===name)))return bad("ลบไม่ได้: Automation ใช้ Action นี้อยู่ กรุณานำออกจากขั้นตอนก่อน");const parent=(db.prepare("SELECT label,config_json FROM _actions WHERE kind='grouped'").all() as any[]).find(a=>(JSON.parse(a.config_json).actions||[]).includes(name));if(parent)return bad('ลบไม่ได้: ชุด "'+parent.label+'" ใช้ Action นี้อยู่'); const used = (db.prepare("SELECT label,display_json FROM _views").all() as {label:string;display_json:string}[]).find(v => { const d=JSON.parse(v.display_json); return d.row_click === "action" && d.row_action === name||d.form_saved_action===name||customActions(d.custom_page).includes(name); }); if (used) return bad(`ลบไม่ได้: View "${used.label}" ใช้ Action นี้อยู่ กรุณานำออกจากการคลิกแถวหรือ Action หลังบันทึกก่อน`); const changed=db.transaction(()=>{const count=db.prepare("DELETE FROM _actions WHERE name=?").run(name).changes;pruneApplicationActionGrants(db);return count;})(); return changed ? NextResponse.json({ok:true}) : bad("ไม่พบ Action",404); } catch(e) { return bad(errorMessage(e),errorStatus(e)); } }

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);
