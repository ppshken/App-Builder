import {parseGrouping,sqlGroupingSupported,groupedSqlPage,groupedMemoryPage} from '@/lib/grouped-pagination';
import {realtimeReadVersions} from '@/lib/realtime-read-version';
import {assertRowVersion} from '@/lib/row-version';
import {refreshExternalTable} from '@/lib/external-sources';
import {writeColumns} from '@/lib/shared-table-columns';
import {mapViewScope,scopedMapRows} from '@/lib/map-view-scope';
import {viewFilterOptions} from '@/lib/view-filter-options';
import {sqlPageWindow} from '@/lib/sql-page-window';
import {sliceSql} from '@/lib/slice-sql';
import {saveFormWithImages} from '@/lib/form-images';
import {readFormImageRequest} from '@/lib/form-image-request';
import {deleteRecord} from "@/lib/delete-record";
import {readRows,withReferenceLabels} from "@/lib/view-records";
import {writeRecord} from "@/lib/data-write";
import {visibleRawRows,hasRowRule,rowAllowed,assertRowAllowed} from "@/lib/row-access";
import {errorStatus} from "@/lib/api";
import {assertTablePermission,assertReferenceWrites} from "@/lib/permissions";
import {withAuth} from "@/lib/auth-api";
import {parseFilters,matchesFilters,filterSql} from "@/lib/data-filters";
import {cascadeEnumListValues} from "@/lib/enumlist-reference-updates";
﻿import {assertUniqueRow,uniqueErrorFields} from "@/lib/unique";
import { NextResponse } from "next/server";
import { db, columnsOf, tableExists, labelCol } from "@/lib/db";
import { calculateRow, calculateInsertRow, assertEditableChanges, Column, validateRow } from "@/lib/columns";
import { bad, errorMessage, readBody } from "@/lib/api";
import { matches, sliceFor } from "@/lib/automation";
import { checkImages } from "@/lib/images";
import { expressionContext } from "@/lib/expression-context";
import { checkLists, checkListDelete, listPage } from "@/lib/lists";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
async function handleGET(req: Request, { params }: { params: { table: string } }) {
  const t = params.table;
  try {
    if (!tableExists(t)) return bad("ไม่พบตาราง", 404);
    await refreshExternalTable(t,new URL(req.url).searchParams.get("refresh_source")==="1");
    const cols = columnsOf(t), now = new Date(), userEmail = previewEmail(req), u = new URL(req.url), context = expressionContext(now, userEmail);
    if(u.searchParams.has("options_for"))return NextResponse.json(viewFilterOptions(t,u.searchParams,userEmail));
    if (u.searchParams.get("defaults") === "1") {
      const defaultColumns=writeColumns(db,t);
      const { row, errors } = calculateRow(defaultColumns, {}, true, now, true, userEmail, context);
      const firstError = defaultColumns.find(c => !c.is_virtual && errors[c.name]);
      if (firstError) throw new Error(`ค่าเริ่มต้นของ "${firstError.label}": ${errors[firstError.name]}`);
      return NextResponse.json({ values: Object.fromEntries(defaultColumns.filter(c => !c.is_virtual).map(c => [c.name, c.type === "yesno" ? row[c.name] ?? 0 : row[c.name]])) });
    }
    // Capture before synchronous reads: a later write must never be marked as covered.
    const realtimeHeaders={'X-Nocode-Realtime-Versions':JSON.stringify(realtimeReadVersions())};
    const filters=parseFilters(u.searchParams.get("filters"),cols),paged=u.searchParams.has("page"),size=Number(u.searchParams.get("page_size")||25),requested=Number(u.searchParams.get("page")||1);
    if(paged&&(!Number.isSafeInteger(requested)||requested<1||![10,25,50,100].includes(size)))return bad("หน้าหรือจำนวนรายการต่อหน้าไม่ถูกต้อง");
    const grouping=parseGrouping(u.searchParams,cols);if(grouping&&!paged)return bad("การจัดกลุ่มต้องใช้การแบ่งหน้า");let groupResult:ReturnType<typeof groupedSqlPage>|undefined;
    const requestedSort=cols.find(c=>c.name===u.searchParams.get("sort")),search=u.searchParams.get("q")||"";
    const wanted=u.searchParams.get("id");if(wanted&&(!/^[1-9]\d*$/.test(wanted)||!Number.isSafeInteger(Number(wanted))))return bad("รหัสแถวไม่ถูกต้อง");
    const mapScope=mapViewScope(t,u.searchParams.get("map_scope"));
    const slice=sliceFor(u.searchParams.get("slice"),t),slicePlan=slice?sliceSql(slice.filter_expr,cols,userEmail):null;
    const fast=paged&&(!grouping||sqlGroupingSupported(grouping.levels,cols))&&!mapScope&&(!slice||!!slicePlan)&&!u.searchParams.get("id")&&!requestedSort?.is_virtual&&!filters.some(f=>cols.find(c=>c.name===f.column)?.is_virtual||["list","enumlist"].includes(cols.find(c=>c.name===f.column)!.type))&&(!search||!cols.some(c=>c.is_virtual||c.type==="ref"));
    let page=requested,total=0,rawRows:Row[]|undefined;
    if(wanted)rawRows=db.prepare(`SELECT * FROM "t_${t}" WHERE id=?`).all(Number(wanted)) as Row[];
    // Ref choices only return 500 rows; limit before calculating every row in the table.
    if(!mapScope&&u.searchParams.get("all")!=="1"&&!paged&&!wanted&&!search&&!filters.length&&!u.searchParams.get("slice")&&!requestedSort&&!hasRowRule(t)){
      const direction=u.searchParams.get("dir")==="asc"?"ASC":"DESC";
      rawRows=db.prepare(`SELECT * FROM "t_${t}" ORDER BY id ${direction} LIMIT 500`).all() as Row[];
    }
    if(fast)db.transaction(()=>{const query=filterSql(filters,cols);let where=query.where;const args=query.args;if(slicePlan){where+=' AND ('+slicePlan.where+')';args.push(...slicePlan.args);}if(search&&cols.length){where+=' AND ('+cols.filter(c=>!c.is_virtual).map(c=>'instr(lower(CAST("'+c.name+'" AS TEXT)),lower(?))>0').join(' OR ')+')';args.push(...cols.filter(c=>!c.is_virtual).map(()=>search));}
      if(hasRowRule(t)){const permitted=visibleRawRows(t,db.prepare(`SELECT * FROM "t_${t}" WHERE ${where}`).all(...args) as Row[]).map(r=>r.id);where+=' AND id IN (SELECT value FROM json_each(?))';args.push(JSON.stringify(permitted));}
      if(grouping){groupResult=groupedSqlPage(t,cols,grouping.levels,grouping.path,where,args,requestedSort?.name||'id',u.searchParams.get('dir')==='asc'?'ASC':'DESC',requested,size,now,userEmail,context);rawRows=groupResult.rows;total=groupResult.total;page=groupResult.page;return;}
      total=(db.prepare('SELECT COUNT(*) AS total FROM "t_'+t+'" WHERE '+where).get(...args) as {total:number}).total;page=Math.min(requested,Math.max(1,Math.ceil(total/size)));const key=requestedSort?.name||"id",direction=u.searchParams.get("dir")==="asc"?"ASC":"DESC";
      const window=sqlPageWindow(total,page,size,direction);
      rawRows=db.prepare('SELECT * FROM "t_'+t+'" WHERE '+where+' ORDER BY "'+key+'" '+window.direction+',id '+window.direction+' LIMIT ? OFFSET ?').all(...args,window.limit,window.offset) as Row[];
      if(window.reverse)rawRows.reverse();
    })();
    // Unpaged Dashboard, Ref-label search and virtual sorting also benefit from
    // safe Slice pushdown; permissions and the interpreter checks still run below.
    if(slicePlan&&rawRows===undefined)rawRows=db.prepare('SELECT * FROM "t_'+t+'" WHERE '+slicePlan.where).all(...slicePlan.args) as Row[];
    let rows = readRows(t, cols, now, userEmail, context,rawRows);
    if (slice) rows = rows.filter(row => matches(slice.filter_expr, row, userEmail, t, context));
    if(mapScope)rows=scopedMapRows(t,rows,mapScope,userEmail,context);
    const wantedId = u.searchParams.get("id");
    if (wantedId) {
      if (!/^[1-9]\d*$/.test(wantedId)) return bad("รหัสแถวไม่ถูกต้อง");
      rows = rows.filter(r => r.id === Number(wantedId));
    }
    rows = withReferenceLabels(t, cols, rows, now, userEmail, context);
    if(!fast)rows=rows.filter(row=>matchesFilters(row,filters,cols));
    const q = (u.searchParams.get("q") || "").toLocaleLowerCase();
    if (q&&!fast) rows = rows.filter(r => cols.some(c => String(c.type === "ref" ? r[`${c.name}__label`] ?? "" : r[c.name] ?? "").toLocaleLowerCase().includes(q)));
    const sort = cols.find(c => c.name === u.searchParams.get("sort"))?.name ?? "id", direction = u.searchParams.get("dir") === "asc" ? 1 : -1;
    if(!fast)rows.sort((a, b) => {
      const left = a[sort], right = b[sort];
      const comparison = left == null ? right == null ? 0 : -1 : right == null ? 1 : typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "th");
      return direction * (comparison || a.id - b.id);
    });
    if(paged){if(grouping&&!fast){groupResult=groupedMemoryPage(rows,grouping.levels,grouping.path,cols,requested,size);rows=groupResult.rows;total=groupResult.total;page=groupResult.page;}else if(!fast){total=rows.length;page=Math.min(requested,Math.max(1,Math.ceil(total/size)));rows=rows.slice((page-1)*size,page*size);}return NextResponse.json({rows,total,page,page_size:size,pages:Math.max(1,Math.ceil(total/size)),...(groupResult?{groups:groupResult.groups,group_total:groupResult.group_total,group_path:groupResult.group_path}:{})},{headers:realtimeHeaders});}
    return NextResponse.json(u.searchParams.get("all")==="1"?rows:rows.slice(0, 500),{headers:realtimeHeaders});
  } catch (e) { return bad(errorMessage(e),errorStatus(e),uniqueErrorFields(e)); }
}
async function handlePOST(req:Request,{params}:{params:{table:string}}){try{const submission=await readFormImageRequest(req);return NextResponse.json(saveFormWithImages(params.table,submission.values,undefined,new URL(req.url).searchParams.get("form_view"),previewEmail(req),submission.images));}catch(e){return bad(errorMessage(e),errorStatus(e),uniqueErrorFields(e));}}
async function handlePUT(req:Request,{params}:{params:{table:string}}){try{const id=new URL(req.url).searchParams.get("id");if(!id||!/^[1-9]\d*$/.test(id))return bad("ไม่พบข้อมูล",404);const submission=await readFormImageRequest(req);return NextResponse.json(saveFormWithImages(params.table,submission.values,Number(id),new URL(req.url).searchParams.get("form_view"),previewEmail(req),submission.images));}catch(e){return bad(errorMessage(e),errorStatus(e),uniqueErrorFields(e));}}
async function handleDELETE(req: Request, { params }: { params: { table: string } }) {
  const t = params.table, id = new URL(req.url).searchParams.get("id");
  try {
    if (!tableExists(t) || !id || !/^[1-9]\d*$/.test(id)) return bad("ไม่พบข้อมูล", 404);
    columnsOf(t);
    const version=new URL(req.url).searchParams.get('version');
    const result = db.transaction(()=>{if(version!==null)assertRowVersion(t,writeColumns(db,t),db.prepare('SELECT * FROM "t_'+t+'" WHERE id=?').get(Number(id)) as Record<string,any>|undefined,version);return deleteRecord(t,Number(id));}).immediate();
    return result.changes ? NextResponse.json({ ok: true }) : bad("ไม่พบข้อมูล", 404);
  } catch (e) { return bad(errorMessage(e),errorStatus(e),uniqueErrorFields(e)); }
}

function previewEmail(req: Request) { const email = req.headers.get("x-nocode-preview-email") || ""; if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("อีเมลสำหรับ Preview ไม่ถูกต้อง"); return email.toLowerCase(); }

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);
