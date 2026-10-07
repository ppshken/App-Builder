import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import { displayColumnNames } from "@/lib/view-display";
import { NextResponse } from "next/server";
import { db, columnsOf, tableExists } from "@/lib/db";
import { assertIdentifier } from "@/lib/columns";
import { checkFormula, slices } from "@/lib/automation";
import { bad, errorMessage, readBody } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handleGET() { try { return NextResponse.json(slices()); } catch(e) { return bad(errorMessage(e),errorStatus(e)); } }
async function handlePOST(req: Request) { return write(req, false); }
async function handlePUT(req: Request) { return write(req, true); }
async function write(req: Request, existing: boolean) {
  try {
    const b = await readBody(req); assertIdentifier(b.name);
    if (!tableExists(b.table_name)) throw new Error("กรุณาเลือกตาราง");
    if (typeof b.label !== "string" || !b.label.trim()) throw new Error("กรุณาตั้งชื่อ Slice");
    const formula = checkFormula(b.table_name, b.filter_expr);
    const names = new Set(columnsOf(b.table_name).map(c => c.name));
    if (!Array.isArray(b.columns) || b.columns.length > 200 || b.columns.some((n: unknown) => typeof n !== "string" || !names.has(n))) throw new Error("กรุณาเลือกคอลัมน์จากตารางนี้");
    if (existing && !db.prepare("SELECT 1 FROM _slices WHERE name=?").get(b.name)) return bad("ไม่พบ Slice", 404);
    const used = db.prepare("SELECT table_name,columns_json,sort_column,group_column,display_json FROM _views WHERE slice_name=?").all(b.name) as any[];
    if (used.some(v => v.table_name !== b.table_name || b.columns.length && (JSON.parse(v.columns_json).some((n: string) => !b.columns.includes(n)) || v.sort_column !== "id" && !b.columns.includes(v.sort_column) || v.group_column && v.group_column !== "id" && !b.columns.includes(v.group_column) || displayColumnNames(JSON.parse(v.display_json)).some(n => !b.columns.includes(n))))) throw new Error("View ใช้ Slice นี้อยู่ กรุณาแก้ View ก่อนเปลี่ยนตารางหรือตัดคอลัมน์ที่ View ใช้");
    const values = [b.label.trim(), b.table_name, formula, JSON.stringify([...new Set(b.columns)]), b.name];
    db.prepare(existing ? "UPDATE _slices SET label=?,table_name=?,filter_expr=?,columns_json=? WHERE name=?" : "INSERT INTO _slices(label,table_name,filter_expr,columns_json,name) VALUES(?,?,?,?,?)").run(...values);
    return NextResponse.json({ ok: true });
  } catch(e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handleDELETE(req: Request) { try {
  const name = new URL(req.url).searchParams.get("name"); assertIdentifier(name);
  if (db.prepare("SELECT 1 FROM _views WHERE slice_name=?").get(name)) throw new Error("ลบ Slice ไม่ได้ มี View ใช้อยู่ กรุณาเปลี่ยนแหล่งข้อมูลของ View ก่อน");
  return db.prepare("DELETE FROM _slices WHERE name=?").run(name).changes ? NextResponse.json({ ok: true }) : bad("ไม่พบ Slice",404);
} catch(e) { return bad(errorMessage(e),errorStatus(e)); } }

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);
