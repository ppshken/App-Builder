import {customTargets} from './custom-page';
import {tableAccess} from './access';
import {viewNameError,runtimeViewName} from "./view-names";
import {readAppSettings} from "./settings-server";
import type {DisplayKind} from "./view-display";
import {validateSpecialView} from "./special-view-config";
import {errorStatus} from "@/lib/api";
import {canRead,currentAccess} from "@/lib/permissions";
import {withAuth} from "@/lib/auth-api";
import { NextResponse } from "next/server";
import { db, columnsOf, tableExists } from "@/lib/db";
import { assertIdentifier } from "@/lib/columns";
import { VIEW_KINDS, VIEW_POSITIONS, VIEW_ICONS } from "@/lib/views";
import { bad, errorMessage, readBody } from "@/lib/api";
import { validateDisplay } from "@/lib/view-display";
import { validateViewCondition, viewIsVisible } from "@/lib/view-visibility";
import { expressionContext } from "@/lib/expression-context";
import { sliceFor } from "@/lib/automation";
import { validateRelatedDisplay, inlineBindings } from "@/lib/inline-views";

async function handleGET(req: Request) {
  try {
    const rows = db.prepare("SELECT * FROM _views ORDER BY pos,name").all() as Record<string, any>[];
    const all: Record<string, any>[] = rows.filter(v=>["dashboard","custom"].includes(v.kind)||canRead(v.table_name)).map(({ columns_json, display_json, ...v }) => ({ ...v, table_name:v.table_name||"", columns: JSON.parse(columns_json), display: JSON.parse(display_json) }));
    if (new URL(req.url).searchParams.get("runtime") !== "1") return NextResponse.json(all);
    const email = req.headers.get("x-nocode-preview-email") || "";
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("อีเมลสำหรับ Preview ไม่ถูกต้อง");
    const now = new Date(), context = { ...expressionContext(now, email.toLowerCase()), now, userEmail: email.toLowerCase() }, errors: string[] = [], hidden: string[] = [];
    const visible = all.filter(v => { try { if(v.kind==="form"&&!tableAccess(currentAccess(),v.table_name).create&&(v.position!=="ref"||!tableAccess(currentAccess(),v.table_name).update)){hidden.push(v.name);return false;} if (viewIsVisible(v.show_if, context)) return true; hidden.push(v.name); } catch(e) { errors.push(`Show_If ของ "${v.label}": ${errorMessage(e)}`); hidden.push(v.name); } return false; });
    return NextResponse.json({ views: visible.map(v=>runtimeViewName(v as any)), hidden, errors });
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePOST(req: Request) { return write(req, false); }
async function handlePUT(req: Request) { return write(req, true); }
async function write(req: Request, existing: boolean, preview = false) {
  try {
    const b = await readBody(req); assertIdentifier(b.name);
    const previous = existing ? db.prepare("SELECT * FROM _views WHERE name=?").get(b.name) as Record<string, any> | undefined : undefined;
    if (existing && !previous) return bad("ไม่พบมุมมอง", 404);
    const currentName = previous || (preview ? db.prepare("SELECT name,label FROM _views WHERE name=?").get(b.name) as {name:string;label:string}|undefined : undefined);
    if(!existing&&!preview&&db.prepare("SELECT 1 FROM _views WHERE name=?").get(b.name))throw Error("ชื่อในระบบของ View ซ้ำ กรุณาโหลดหน้าใหม่แล้วสร้าง View อีกครั้ง");
    const nameError=viewNameError(b.label,db.prepare("SELECT name,label FROM _views").all() as {name:string;label:string}[],currentName as {name:string;label:string}|undefined);
    if(nameError)throw Error(nameError);
    if(["dashboard","custom"].includes(b.kind)){b.table_name=null;b.slice_name=null;b.columns=[];b.sort_column="id";b.group_column="";}
    if (!["dashboard","custom"].includes(b.kind) && !tableExists(b.table_name)) throw new Error("กรุณาเลือกตารางที่มีอยู่");
    if (!VIEW_KINDS.some(([k]) => k === b.kind) || !VIEW_POSITIONS.some(([p]) => p === b.position)) throw new Error("ชนิดหรือตำแหน่งมุมมองไม่ถูกต้อง");
    if (b.position === "ref" && !["detail", "form", "list", "table", "map", "chart", "calendar", "dashboard", "custom"].includes(b.kind)) throw new Error("ชนิด Reference View ไม่ถูกต้อง");
    const slice = ["dashboard","custom"].includes(b.kind)?null:sliceFor(b.slice_name || null, b.table_name);
    const inlineRef = b.position === "inline" ? b.inline_ref ?? previous?.inline_ref ?? "" : "";
    if(b.position === "inline") {
      if(!["list","table"].includes(b.kind))throw new Error("Inline View ใช้รูปแบบรายการหรือตารางเท่านั้น");
      if(slice)throw new Error("Inline View ใช้ตารางโดยตรง ระบบกรองด้วย Ref ของแถวต้นทางให้แล้ว");
      if(!columnsOf(b.table_name).some(c=>c.name===inlineRef && c.type==="ref" && !c.is_virtual))throw new Error("กรุณาเลือกคอลัมน์ Ref ที่เก็บในตารางสำหรับ Inline View");
      if(b.sort_column!=="id" && columnsOf(b.table_name).find(c=>c.name===b.sort_column)?.is_virtual)throw new Error("Inline View ต้องเรียงด้วยคอลัมน์ที่เก็บในตาราง เพื่อดึงข้อมูลทีละหน้า");
    }
    if(previous && inlineBindings(b.name).length && (previous.position!==b.position || previous.table_name!==b.table_name || previous.inline_ref!==inlineRef))throw new Error("Inline View นี้ถูกใช้ใน Related กรุณายกเลิกการเลือกใน View รายละเอียดก่อนเปลี่ยนความสัมพันธ์");
    const cols = (["dashboard","custom"].includes(b.kind)?[]:columnsOf(b.table_name)).filter(c => !slice?.columns.length || slice.columns.includes(c.name)), names = new Set(cols.map(c => c.name));
    if (!Array.isArray(b.columns) || b.columns.length > 200 || b.columns.some((c: unknown) => typeof c !== "string" || !names.has(c))) throw new Error("คอลัมน์ของมุมมองไม่ถูกต้อง กรุณาเลือกจากตารางนี้");
    if (b.sort_column !== "id" && !names.has(b.sort_column)) throw new Error("คอลัมน์เรียงข้อมูลไม่ถูกต้อง");
    if (!["asc", "desc"].includes(b.sort_dir) || !Number.isSafeInteger(b.pos) || b.pos < 0 || b.pos > 9999) throw new Error("ลำดับมุมมองต้องเป็น 0–9999");
    const rawMenuGroup=b.menu_group===undefined?previous?.menu_group??"":b.menu_group;
    if(typeof rawMenuGroup!=="string"||rawMenuGroup.length>100)throw Error("ชื่อกรุ๊ปเมนูต้องเป็นข้อความไม่เกิน 100 ตัวอักษร");
    const menuGroup=b.position==="menu"?rawMenuGroup.trim():"";
    const icon = b.icon ?? previous?.icon ?? "", group = b.group_column ?? previous?.group_column ?? "", groupDir = b.group_dir ?? previous?.group_dir ?? "asc";
    if (icon !== "" && !VIEW_ICONS.some(([name]) => name === icon)) throw new Error("ไอคอนไม่ถูกต้อง กรุณาเลือกจากรายการ");
    if (group !== "" && group !== "id" && !names.has(group)) throw new Error("คอลัมน์จัดกลุ่มไม่ถูกต้อง กรุณาเลือกจากตารางหรือ Slice นี้");
    if (!["asc", "desc"].includes(groupDir)) throw new Error("ทิศทางเรียงกลุ่มไม่ถูกต้อง");
    if(b.position==="inline" && cols.find(c=>c.name===group)?.is_virtual)throw new Error("Inline View ต้องจัดกลุ่มด้วยคอลัมน์ที่เก็บในตาราง เพื่อดึงข้อมูลทีละหน้า");
    const display = validateDisplay(b.display === undefined ? JSON.parse(previous?.display_json || "{}") : b.display, cols);
    if(display.group_by?.some(g=>g.column!=="id"&&!names.has(g.column)))throw Error("คอลัมน์จัดกลุ่มไม่อยู่ในตารางหรือ Slice นี้");
    if(b.position==="inline"&&display.group_by?.some(g=>cols.find(c=>c.name===g.column)?.is_virtual))throw Error("Inline View ต้องจัดกลุ่มด้วยคอลัมน์ที่เก็บในตาราง");
    if(existing&&(b.position==='inline'||b.kind==='detail')){const parents=db.prepare("SELECT display_json FROM _views WHERE kind='custom' AND name<>?").all(b.name) as {display_json:string}[];if(parents.some(v=>customTargets(JSON.parse(v.display_json).custom_page).includes(b.name)))throw Error("View นี้ถูกเปิดจากปุ่มในหน้ากำหนดเอง กรุณานำปุ่มอ้างอิงออกก่อนเปลี่ยนรูปแบบ");}
    if(display.custom_page&&b.kind!=="custom")throw Error("ตัวออกแบบหน้าจอใช้ได้เฉพาะ View กำหนดเอง");
    for(const target of customTargets(display.custom_page))if(!db.prepare("SELECT 1 FROM _views WHERE name=? AND position<>'inline' AND kind<>'detail'").get(target))throw Error("ปุ่มอ้างอิง View ที่ไม่มีอยู่หรือเปิดโดยไม่มีแถวไม่ได้");
    validateRelatedDisplay(display,b.table_name,b.kind);
    validateSpecialView(b.kind,{...readAppSettings().display_defaults[b.kind as DisplayKind],...display},db.prepare("SELECT name,kind,position FROM _views").all() as any[],b.name);
    if(existing&&(!["list","table","map","chart","calendar"].includes(b.kind)||b.position==="inline")&&db.prepare("SELECT 1 FROM _views WHERE name<>? AND EXISTS(SELECT 1 FROM json_each(json_extract(display_json,'$.dashboard_views')) WHERE value=?)").get(b.name,b.name))throw Error("View นี้ถูกใช้ในแดชบอร์ดอื่น กรุณานำออกก่อนเปลี่ยนชนิดหรือตำแหน่ง");
    const showIf = validateViewCondition(b.show_if === undefined ? previous?.show_if ?? "" : b.show_if, Object.fromEntries((db.prepare("SELECT name FROM _tables").all() as {name:string}[]).map(t => [t.name, columnsOf(t.name)])));
    if (showIf) viewIsVisible(showIf, { ...expressionContext(), userEmail:"" });
    if(display.form_saved_action&&!(db.prepare("SELECT 1 FROM _actions WHERE name=? AND table_name=?").get(display.form_saved_action,b.table_name)))throw Error("กรุณาเลือก Action ของตารางนี้สำหรับหลังบันทึกฟอร์ม");
    if (display.row_click === "action" && !(db.prepare("SELECT 1 FROM _actions WHERE name=? AND table_name=?").get(display.row_action || "", b.table_name))) throw new Error("กรุณาเลือก Action ของตารางนี้สำหรับการคลิกแถว");
    if(preview)return NextResponse.json({view:runtimeViewName({...b,table_name:b.table_name||"",label:b.label.trim(),columns:[...new Set(b.columns)],slice_name:slice?.name||null,inline_ref:inlineRef,menu_group:menuGroup,icon,group_column:group,group_dir:groupDir,display,show_if:showIf}),visible:viewIsVisible(showIf,{...expressionContext(),userEmail:req.headers.get("x-nocode-preview-email")||""})});
    const args = [b.label.trim(), b.table_name, b.kind, b.position, b.pos, JSON.stringify([...new Set(b.columns)]), b.sort_column, b.sort_dir, slice?.name || null, icon, group, groupDir, JSON.stringify(display), showIf, inlineRef, menuGroup, b.name];
    if (existing) db.prepare("UPDATE _views SET label=?,table_name=?,kind=?,position=?,pos=?,columns_json=?,sort_column=?,sort_dir=?,slice_name=?,icon=?,group_column=?,group_dir=?,display_json=?,show_if=?,inline_ref=?,menu_group=? WHERE name=?").run(...args);
    else db.prepare("INSERT INTO _views(label,table_name,kind,position,pos,columns_json,sort_column,sort_dir,slice_name,icon,group_column,group_dir,display_json,show_if,inline_ref,menu_group,name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...args);
    return NextResponse.json({ ok: true });
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handleDELETE(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name"); assertIdentifier(name);
    if((db.prepare("SELECT home_view FROM _app_settings WHERE id=1").get() as {home_view:string}).home_view===name)return bad("ลบไม่ได้: View นี้เป็นหน้าแรกหลังเข้าสู่ระบบ กรุณาเลือกหน้าแรกอื่นในการตั้งค่าแอพก่อน");
    const customParents=db.prepare("SELECT name,label,display_json FROM _views WHERE kind='custom' AND name<>?").all(name) as {name:string;label:string;display_json:string}[];
    if(customParents.some(v=>customTargets(JSON.parse(v.display_json).custom_page).includes(name)))return bad("ลบไม่ได้: มีปุ่มในหน้ากำหนดเองเปิด View นี้อยู่ กรุณานำออกก่อน");
    const parent=db.prepare("SELECT label FROM _views WHERE kind='dashboard' AND EXISTS(SELECT 1 FROM json_each(json_extract(display_json,'$.dashboard_views')) WHERE value=?)").get(name) as {label:string}|undefined;if(parent)return bad(`ลบไม่ได้: แดชบอร์ด "${parent.label}" ใช้ View นี้อยู่ กรุณานำออกก่อน`);
    if(readAppSettings().header.notifications_view===name)return bad("ลบไม่ได้: Header ใช้ View นี้เป็นหน้าแจ้งเตือน กรุณาเปลี่ยนหน้าแจ้งเตือนก่อน");
    const action=db.prepare("SELECT label FROM _actions WHERE kind IN ('open_view','edit_form','new_form','open_detail') AND json_extract(config_json,'$.view_name')=?").get(name) as {label:string}|undefined;if(action)return bad(`ลบไม่ได้: Action "${action.label}" เปิดหน้านี้อยู่ กรุณาแก้ Action ก่อน`);
    const used=inlineBindings(name);if(used.length)return bad(`ลบไม่ได้: Related ของ "${used[0].label}" ใช้ Inline View นี้อยู่ กรุณาเลือกอัตโนมัติหรือ View อื่นก่อน`);
    const r = db.prepare("DELETE FROM _views WHERE name=?").run(name);
    return r.changes ? NextResponse.json({ ok: true }) : bad("ไม่พบมุมมอง", 404);
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);

export async function previewView(req:Request){return write(req,false,true);}
