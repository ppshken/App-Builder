import {viewGroups} from "./view-groups";
import {rowVersion} from "./row-version";
import {actionPermission} from "./action-config";
import {visibleRawRows,hasRowRule,assertRowAllowed,rowAllowed} from "./row-access";
import {canRead,assertTablePermission,canExecuteAction} from "./permissions";
import { db, columnsOf, tableExists } from "./db";
import { labelTextColumn,labelImageColumn,calculateRow, Column } from "./columns";
import {loadReferenceLabels} from "./reference-labels";
import { expressionContext } from "./expression-context";
import { references, evaluateExpression, asBoolean } from "./expression";
import { refTablesOf } from "./columns";
import { displayColumnNames } from "./view-display";
import type { AppView } from "./views";
import { visibleColumns } from "./views";
import { viewIsVisible } from "./view-visibility";

export type RelatedList = { table: string; column: string; label: string; list_limit: number; required?:boolean };
export function relatedLists(table: string): RelatedList[] {
  if (!tableExists(table)) throw new Error("ไม่พบตาราง");
  const tables = db.prepare("SELECT name,label FROM _tables WHERE name IN (SELECT table_name FROM _columns WHERE ref_table=? AND type='ref' AND COALESCE(is_virtual,0)=0) ORDER BY label,name").all(table) as {name:string;label:string}[];
  return tables.filter(t=>canRead(t.name)).flatMap(t => columnsOf(t.name).filter(c => c.type === "ref" && !c.is_virtual && c.ref_table === table).map(c => ({table:t.name,column:c.name,label:`${t.label} · ${c.label}`,required:!!c.related_required,list_limit:c.list_limit ?? 5})));
}
export function listKey(table: string) { if (!tableExists(table)) throw Error("ไม่พบตารางอ้างอิง"); return "id"; }
export function checkLists(cols: Column[], row: Record<string, unknown>) {
  for (const c of cols.filter(c => c.type === "list" && c.ref_table && !c.is_virtual)) {
    const target = c.ref_table!, key = listKey(target);
    const missing = db.prepare(`SELECT value FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM "t_${target}" WHERE CAST("${key}" AS TEXT)=CAST(json_each.value AS TEXT)) LIMIT 1`).get(JSON.stringify(row[c.name] ?? []));
    if (missing) throw new Error(`"${c.label}" มีรหัสที่ไม่พบในตารางอ้างอิง กรุณาเลือกข้อมูลที่มีอยู่`);
  }
}
export function checkListDelete(table: string, id: number) {
  const key = listKey(table), row = db.prepare(`SELECT "${key}" AS key FROM "t_${table}" WHERE id=?`).get(id) as {key:unknown}|undefined;
  if (!row) return;
  const tables = db.prepare("SELECT name FROM _tables").all() as {name:string}[];
  for (const t of tables) for (const c of columnsOf(t.name).filter(c => c.type === "list" && !c.is_virtual && c.ref_table === table)) {
    const used = db.prepare(`SELECT 1 FROM "t_${t.name}", json_each("t_${t.name}"."${c.name}") WHERE CAST(json_each.value AS TEXT)=? LIMIT 1`).get(String(row.key));
    if (used) throw new Error(`ลบไม่ได้: รายการใน "${t.name} · ${c.label}" อ้างอิงแถวนี้อยู่ กรุณานำออกจากรายการก่อน`);
  }
}
function labelColumns(cols: Column[], names: string[]): Column[] {
  const needed = new Set(names), queue = [...names];
  while(queue.length) {
    const c = cols.find(c=>c.name===queue.shift());
    if(c?.is_virtual && c.virtual_expr) for(const ref of references(c.virtual_expr)) if(!needed.has(ref)) { needed.add(ref); queue.push(ref); }
  }
  return cols.filter(c=>needed.has(c.name));
}
export function listPage(table: string, query: URLSearchParams, userEmail = "", keys?: unknown) {
  assertTablePermission(table,"read");
  if (!tableExists(table)) throw new Error("ไม่พบตาราง");
  const cols = columnsOf(table), owner = query.get("owner"), column = query.get("column"), id = query.get("id"), mode = query.get("mode");
  const pageText = query.get("page") || "1";
  if (!/^[1-9]\d{0,8}$/.test(pageText)) throw new Error("เลขหน้าต้องเป็นจำนวนเต็มตั้งแต่ 1");
  if(owner)assertTablePermission(owner,"read");
  let defaultLimit = 5, where = "", bindings: (string|number)[] = [];
  if (mode === "related") {
    if (!owner || !tableExists(owner) || !id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("ข้อมูลอ้างอิงไม่ถูกต้อง");
    const c = cols.find(c => c.name === column && c.type === "ref" && !c.is_virtual && c.ref_table === owner);
    if (!c) throw new Error("ไม่พบความสัมพันธ์ของตารางนี้");
    if (!db.prepare(`SELECT 1 FROM "t_${owner}" WHERE id=?`).get(id)) throw new Error("ไม่พบแถวข้อมูลต้นทาง");
    assertRowAllowed(owner,db.prepare(`SELECT * FROM "t_${owner}" WHERE id=?`).get(id) as any);
    defaultLimit = c.list_limit ?? 5; where = ` WHERE "${c.name}"=?`; bindings = [Number(id)];
  } else if (mode === "list") {
    if (!owner || !tableExists(owner) || !id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
    const ownerCols = columnsOf(owner), c = ownerCols.find(c => c.name === column && c.type === "list" && c.ref_table === table);
    if (!c) throw new Error("ไม่พบคอลัมน์ List ที่อ้างอิงตารางนี้");
    const raw = db.prepare(`SELECT * FROM "t_${owner}" WHERE id=?`).get(id) as Record<string,unknown>|undefined;
    if (!raw) throw new Error("ไม่พบแถวข้อมูลต้นทาง");
    assertRowAllowed(owner,raw);
    const values = calculateRow(ownerCols, raw, false, new Date(), false, userEmail, expressionContext(new Date(),userEmail)).row[c.name];
    defaultLimit = c.list_limit ?? 5;
    where = ` WHERE CAST("${listKey(table)}" AS TEXT) IN (SELECT CAST(value AS TEXT) FROM json_each(?))`; bindings = [JSON.stringify(values ?? [])];
  } else if (mode !== null && mode !== "choices") throw new Error("รูปแบบการดึงรายการไม่ถูกต้อง");
  if (keys !== undefined) {
    if (mode && mode !== "choices") throw new Error("ใช้รายการคีย์ได้เฉพาะการเลือกข้อมูล");
    if (!Array.isArray(keys) || keys.length > 10000 || keys.some(v => typeof v !== "string")) throw new Error("รายการคีย์ไม่ถูกต้อง");
    where = ` WHERE CAST("${listKey(table)}" AS TEXT) IN (SELECT CAST(value AS TEXT) FROM json_each(?))`; bindings = [JSON.stringify(keys)];
  }
  if(hasRowRule(table)){const ids=visibleRawRows(table,db.prepare(`SELECT * FROM "t_${table}"${where}`).all(...bindings) as any[]).map(r=>r.id);where+=(where?" AND ":" WHERE ")+"id IN (SELECT value FROM json_each(?))";bindings.push(JSON.stringify(ids));}
  const limitText = query.get("limit") ?? String(defaultLimit);
  if (!["0","5","10","20"].includes(limitText)) throw new Error("จำนวนรายการต่อหน้าต้องเป็น 5, 10, 20 หรือทั้งหมด");
  const limit = Number(limitText), total = (db.prepare(`SELECT COUNT(*) AS total FROM "t_${table}"${where}`).get(...bindings) as {total:number}).total;
  const pages = limit ? Math.max(1, Math.ceil(total/limit)) : 1, page = Math.min(Number(pageText),pages);
  // Filter and page in SQLite before calculating labels. Never fetch all rows to slice in JavaScript.
  const now = new Date(), label = labelTextColumn(cols), image=labelImageColumn(cols), key = listKey(table), context = expressionContext(now,userEmail);
  let view:AppView|undefined;
  if(query.has("view")) {
    const stored=db.prepare("SELECT * FROM _views WHERE name=? AND position='inline'").get(query.get("view")) as any;
    if(!stored || mode!=="related" || stored.table_name!==table || stored.inline_ref!==column || !["list","table"].includes(stored.kind))throw new Error("Inline View ไม่ตรงกับ Related นี้");
    if(!viewIsVisible(stored.show_if,{...context,userEmail,now:new Date()}))throw new Error("Inline View นี้ถูกซ่อนด้วย Show_If");
    view={...stored,columns:JSON.parse(stored.columns_json),display:JSON.parse(stored.display_json)};
  }
  if(view&&query.has("summary")){const mode=query.get("summary");if(!["count","sum","none"].includes(mode||""))throw Error("รูปแบบสรุปข้อมูลไม่ถูกต้อง");const sum=query.get("sum_column")||"";if(mode==="sum"&&!cols.some(c=>c.name===sum&&!c.is_virtual&&["number","decimal"].includes(c.type)))throw Error("กรุณาเลือกคอลัมน์ผลรวมที่เป็นตัวเลขจริง");view={...view,display:{...view.display,group_summary:mode as "count"|"sum"|"none",group_sum_column:sum}};}
  const selected=view ? visibleColumns(cols,view.columns) : [];
  const rowActions=view ? db.prepare("SELECT name,condition_expr,kind FROM _actions WHERE table_name=?").all(table) as {name:string;condition_expr:string;kind:string}[] : [];
  const extra=view ? [...displayColumnNames(view.display),view.group_column||"",(!view.display?.image_column || view.display.image_column==="__auto__") ? cols.find(c=>c.type==="image")?.name || "" : ""] : [];
  const needed=view ? rowActions.length ? cols.map(c=>c.name) : [...selected.map(c=>c.name),...extra] : [];
  const sort=view?.sort_column!=="id" ? cols.find(c=>c.name===view?.sort_column && !c.is_virtual)?.name || "id" : "id", dir=view?.sort_dir==="desc" ? "DESC" : "ASC";
  const group=cols.find(c=>c.name===view?.group_column && !c.is_virtual)?.name;
  const order=viewGroups(view).filter(g=>g.column==="id"||cols.some(c=>c.name===g.column&&!c.is_virtual)).map(g=>`"${g.column}" ${g.direction==="desc"?"DESC":"ASC"},`).join("");
  // Virtual labels may depend on other columns; fetch just the requested page of complete rows.
  const calculation = labelColumns(cols,[key,label,...(image?[image]:[]),...needed]);
  const prepared = (db.prepare(`SELECT * FROM "t_${table}"${where} ORDER BY ${order}"${sort}" ${dir},id ${dir} LIMIT ? OFFSET ?`).all(...bindings, limit || -1, limit ? (page-1)*limit : 0) as Record<string,unknown>[]).map(raw => ({raw,...calculateRow(calculation,raw,false,now,true,userEmail,context)}));
  const refColumns = view ? cols.filter(c=>needed.includes(c.name) && c.type==="ref" && prepared.some(({row})=>row[c.name])) : [];
  const refLabels = loadReferenceLabels(refColumns,prepared.map(({row})=>row),now,userEmail,context);
  const rows = prepared.map(({raw,row,errors}) => {
    for (const c of refColumns) {
      const labeled = refLabels.get(c.ref_table!)?.get(row[c.name] as number);
      if (labeled) {row[`${c.name}__label`]=labeled.label as any;row[`${c.name}__image`]=labeled.image as any;if(labeled.decoration)row[`${c.name}__decoration`]=labeled.decoration as any;}
    }
    const allowedActions=rowActions.filter(a=>{try{return canExecuteAction({...a,table_name:table}) && rowAllowed(table,raw,["copy","add","new_form"].includes(a.kind)?"read":actionPermission(a.kind)) && asBoolean(evaluateExpression(a.condition_expr,row,{...context,refTables:refTablesOf(cols),userEmail}));}catch{return false;}}).map(a=>a.name);
    const businessKey=cols.find(c=>c.is_key)?.name;
    return {id:raw.id,key:String(raw.id),business_key:businessKey ? String(raw[businessKey] ?? "") : null,label:String(row[label] ?? raw.id),image:image?row[image]??null:null,...(view ? {values:{...row,__version:rowVersion(table,cols,raw)},errors,allowedActions,permissions:{update:rowAllowed(table,raw,"update"),delete:rowAllowed(table,raw,"delete")}} : {})};
  });
  let summary:{sum?:number;label?:string;groups?:Record<string,{count:number;sum?:number}>}|undefined;
  if(view){const mode=view.display?.group_summary||"count",sumCol=mode==="sum"?cols.find(c=>c.name===view!.display?.group_sum_column&&!c.is_virtual&&["number","decimal"].includes(c.type)):undefined;summary={};if(sumCol){summary.sum=(db.prepare('SELECT COALESCE(SUM("'+sumCol.name+'"),0) AS value FROM "t_'+table+'"'+where).get(...bindings) as {value:number}).value;summary.label=sumCol.label;}
  const groupCol=view.group_column==="id"?"id":group;if(mode!=="none"&&groupCol&&rows.length){const values=[...new Set(rows.map(r=>(r.values as Record<string,any>|undefined)?.[groupCol]??null))],nonNull=values.filter(v=>v!==null),part='("'+groupCol+'" IN (SELECT value FROM json_each(?))'+(values.includes(null)?' OR "'+groupCol+'" IS NULL':'')+')',groupWhere=where+(where?' AND ':' WHERE ')+part;const grouped=db.prepare('SELECT "'+groupCol+'" AS key,COUNT(*) AS count'+(sumCol?',COALESCE(SUM("'+sumCol.name+'"),0) AS sum':'')+' FROM "t_'+table+'"'+groupWhere+' GROUP BY "'+groupCol+'"').all(...bindings,JSON.stringify(nonNull)) as {key:unknown;count:number;sum?:number}[];summary.groups=Object.fromEntries(grouped.map(g=>[JSON.stringify(g.key??null),{count:g.count,...(sumCol?{sum:g.sum}:{})}]));}}
  let can_add:boolean|undefined;
  if(mode==="related"&&owner&&id){const link=cols.find(c=>c.name===column&&c.type==="ref"&&!c.is_virtual&&c.ref_table===owner);can_add=true;if(link?.is_part_of){try{const parentCols=columnsOf(owner),raw=db.prepare('SELECT * FROM "t_'+owner+'" WHERE id=?').get(Number(id)) as Record<string,any>,parent=calculateRow(parentCols,raw,false,new Date(),false,userEmail,context).row;const ids=link.part_valid_if?.trim()||link.part_add_if?.trim()? (db.prepare('SELECT id FROM "t_'+table+'" WHERE "'+link.name+'"=?').all(Number(id)) as {id:number}[]).map(r=>String(r.id)):[];const options={...context,refTables:refTablesOf(parentCols),userEmail};const allows=(source:string|null|undefined,list:string[])=>!source?.trim()||asBoolean(evaluateExpression(source,{...parent,_THIS:list},options));can_add=allows(link.part_add_if,ids)&&allows(link.part_valid_if,[...ids,"__new_related_record__"]);}catch{can_add=false;}}}
  return {rows,total,page,pages,limit,...(can_add!==undefined?{can_add}:{}),...(summary?{summary}:{}),...(view ? {columns:selected,source_columns:cols} : {})};
}
