import {formulaInputColumns,readMetrics} from '@/lib/formula-performance';
import {assertTablePermission} from "@/lib/permissions";
import {visibleRawRows} from "@/lib/row-access";
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
      const childLinks=db.prepare("SELECT table_name,name FROM _columns WHERE ref_table=? AND (is_part_of=1 OR related_required=1)").all(table) as {table_name:string;name:string}[];
      for(const link of childLinks){const c=columnsOf(link.table_name).find(c=>c.name===link.name);if(c)sources.push(c.part_add_if||"",c.part_show_if||"",c.part_valid_if||"");}

      for (const a of db.prepare("SELECT condition_expr,values_json,config_json FROM _actions WHERE table_name=?").all(table) as {condition_expr:string;values_json:string;config_json:string}[]) sources.push(a.condition_expr,...actionConfigExpressions(JSON.parse(a.config_json||"{}")), ...Object.values(JSON.parse(a.values_json)) as string[]);
      for (const s of db.prepare("SELECT filter_expr FROM _slices WHERE table_name=?").all(table) as {filter_expr:string}[]) sources.push(s.filter_expr);
    }
    let relatedScope:{ownerTable:string;parentIds:number[];deferBlank?:boolean}|undefined;
    const parentIds=u.searchParams.get('related_parent_ids');
    if(parentIds!==null){
      const ids=JSON.parse(parentIds);if(!table||!Array.isArray(ids)||ids.length>500||ids.some(id=>!Number.isSafeInteger(id)||id<1))return bad('Related ต้องระบุรหัสแถวแม่ไม่เกิน 500 รายการ');
      const raw=db.prepare('SELECT * FROM "t_'+table+'" WHERE id IN (SELECT value FROM json_each(?))').all(JSON.stringify(ids)) as Record<string,any>[];
      relatedScope={ownerTable:table,parentIds:visibleRawRows(table,raw).map(r=>Number(r.id)),deferBlank:ids.length>0||u.searchParams.get("display")==="1"};
    }
    return NextResponse.json(expressionContext(new Date(), userEmail.toLowerCase()).snapshot(sources, table ? columnsOf(table) : [],source===null,relatedScope));
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePOST(req: Request) {
  try {
    const { source, columns, table, rowId,profile,sampleFields } = await readBody(req);
    if(profile!==undefined&&typeof profile!=="boolean")return bad("การวัดประสิทธิภาพไม่ถูกต้อง");
    if(sampleFields!==undefined&&(!Array.isArray(sampleFields)||sampleFields.length>201||sampleFields.some((f:unknown)=>typeof f!=="string"||f.length>100)))return bad("ข้อมูลช่องตัวอย่างไม่ถูกต้อง");
    const userEmail = req.headers.get("x-nocode-preview-email") || "";
    if (typeof source !== "string" || !Array.isArray(columns) || columns.length > 200 || typeof userEmail !== "string" || (userEmail && (userEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)))) return bad("ข้อมูลทดสอบสูตรไม่ถูกต้อง");
    // Column information describes unsaved editor fields; SQL still uses checked database metadata only.
    const safe = columns.map(c => ({ name: c.name, label: c.name, type: c.type, ref_table: c.ref_table }));
    let scope:{ownerTable:string;parentIds:number[]}|undefined;
    if(table!==undefined){
      if(typeof table!=='string'||!tableExists(table))return bad('ไม่พบตารางที่ใช้ทดสอบสูตร',404);
      assertTablePermission(table,'read');
      if(rowId!==null&&rowId!==undefined&&(!Number.isSafeInteger(rowId)||rowId<1))return bad('รหัสแถวที่ใช้ทดสอบต้องเป็นจำนวนเต็มบวก');
      const raw=rowId==null?[]:db.prepare('SELECT * FROM "t_'+table+'" WHERE id=?').all(rowId) as Record<string,any>[];
      if(rowId!=null&&!visibleRawRows(table,raw).length)return bad('ไม่พบแถวที่ใช้ทดสอบ หรือไม่มีสิทธิ์อ่าน',403);
      scope={ownerTable:table,parentIds:rowId==null?[]:[rowId]};
    }
    const metrics=readMetrics(),started=performance.now(),ownerColumns=table?columnsOf(table):[];
    const dependencies=formulaInputColumns(source,ownerColumns,[],sampleFields?new Set<string>(sampleFields):undefined).map(c=>c.is_virtual?c.virtual_expr:sampleFields?.includes(c.name)?undefined:c.default_expr).filter((s):s is string=>typeof s==='string'&&!!s.trim());
    const data=expressionContext(new Date(),userEmail.toLowerCase(),db,profile?metrics:undefined).snapshot([source,...dependencies],safe,false,scope);
    return NextResponse.json(profile?{data,performance:{...metrics,loadMs:performance.now()-started}}:data);
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
