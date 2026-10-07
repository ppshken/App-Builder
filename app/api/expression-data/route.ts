import {actionConfigExpressions} from "@/lib/action-config";
import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import { NextResponse } from "next/server";
import { columnsOf, tableExists, db } from "@/lib/db";
import { FORMULA_FIELDS } from "@/lib/columns";
import { expressionContext } from "@/lib/expression-context";
import { bad, errorMessage, readBody } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handleGET(req: Request) {
  try {
    const u = new URL(req.url), table = u.searchParams.get("table"), source = u.searchParams.get("source");
    if (table && !tableExists(table)) return bad("ไม่พบตาราง", 404);
    const userEmail = req.headers.get("x-nocode-preview-email") || "";
    if (userEmail && (userEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail))) return bad("อีเมลสำหรับ Preview ไม่ถูกต้อง");
    const sources = source !== null ? [source] : table ? columnsOf(table).filter(c => u.searchParams.get("display") !== "1" || c.type !== "list").flatMap(c => FORMULA_FIELDS.map(f => c[f] || "")) : [];
    if (source === null && table) {
      for (const a of db.prepare("SELECT condition_expr,values_json,config_json FROM _actions WHERE table_name=?").all(table) as {condition_expr:string;values_json:string;config_json:string}[]) sources.push(a.condition_expr,...actionConfigExpressions(JSON.parse(a.config_json||"{}")), ...Object.values(JSON.parse(a.values_json)) as string[]);
      for (const s of db.prepare("SELECT filter_expr FROM _slices WHERE table_name=?").all(table) as {filter_expr:string}[]) sources.push(s.filter_expr);
    }
    return NextResponse.json(expressionContext(new Date(), userEmail.toLowerCase()).snapshot(sources, table ? columnsOf(table) : [],source===null));
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePOST(req: Request) {
  try {
    const { source, columns } = await readBody(req);
    const userEmail = req.headers.get("x-nocode-preview-email") || "";
    if (typeof source !== "string" || !Array.isArray(columns) || columns.length > 200 || typeof userEmail !== "string" || (userEmail && (userEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)))) return bad("ข้อมูลทดสอบสูตรไม่ถูกต้อง");
    // Column information describes unsaved editor fields; SQL still uses checked database metadata only.
    const safe = columns.map(c => ({ name: c.name, label: c.name, type: c.type, ref_table: c.ref_table }));
    return NextResponse.json(expressionContext(new Date(), userEmail.toLowerCase()).snapshot([source], safe));
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
