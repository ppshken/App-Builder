import {visibleRawRows} from "./row-access";
import {expressionUser} from "./user-settings";
import {assertTablePermission,canRead,currentUser} from "./permissions";
import { db } from "./db";
import type Database from "better-sqlite3";
import {readColumns} from "./schema";
import {IDENT} from "./columns";
import { labelTextColumn,labelImageColumn, calculateRow, FORMULA_FIELDS, Column, refTablesOf } from "./columns";
import { ExpressionContext, ExpressionTable, tableReferences, referencePaths, relatedReferences, references } from "./expression";

// One bounded snapshot per request; never turn expression text into SQL.
export function expressionContext(now = new Date(), userEmail = "", database:Database.Database=db) {
  // Request-local metadata only: never share permissions or snapshots between users.
  const metadata=new Map<string,Column[]>();
  const columnsOf=(name:string)=>{let cols=metadata.get(name);if(!cols){cols=readColumns(database,name);metadata.set(name,cols);}return cols;};
  const tableExists=(name:string)=>IDENT.test(name)&&name!=="id"&&!!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(name);
  const tables: Record<string, ExpressionTable> = Object.create(null), loading = new Set<string>();
  const fullTables = new Map<string, ExpressionTable>(), projections = new Map<string, ExpressionTable>();
  const context: ExpressionContext = { ...expressionUser(currentUser()||null,database), getRelatedTable(name, column) {
    assertTablePermission(name,"read");
    if (fullTables.has(name)) return fullTables.get(name)!;
    const cacheKey = `${name}:${column}`;
    if (projections.has(cacheKey)) return projections.get(cacheKey)!;
    if (loading.has(cacheKey) || loading.size >= 16) throw new Error(`สูตร Related อ้างอิงวนกันที่ ${name}[${column}]`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c=>c.is_key)?.name || "id";
    if (column !== "id" && !cols.some(c=>c.name===column)) throw new Error(`ไม่พบคอลัมน์ [${column}] ในตาราง ${name}`);
    const needed = new Set([column,key,...cols.filter(c=>c.type==="ref"&&!c.is_virtual).map(c=>c.name)]);
    for (const name of needed) { const c=cols.find(c=>c.name===name); if(c?.is_virtual&&c.virtual_expr)for(const ref of references(c.virtual_expr))needed.add(ref); }
    const selected = cols.filter(c=>needed.has(c.name));
    const raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id LIMIT 10001`).all() as Record<string,any>[];
    if (raw.length > 10000) throw new Error(`ตาราง ${name} มีข้อมูลเกิน 10,000 แถวสำหรับสูตร Related`);
    loading.add(cacheKey);
    try {
      // Project only requested values, so unrelated child formulas do not load
      // the parent back into its own Related calculation.
      const rows = visibleRawRows(name,raw,database).map(r=>calculateRow(selected,r,false,now,false,userEmail,context).row);
      const data: ExpressionTable = {columns:["id",...selected.map(c=>c.name)],key,rows,labels:Object.fromEntries(rows.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[key])])),refs:refTablesOf(cols),relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual))};
      projections.set(cacheKey,data);
      const prior=tables[name];
      if(prior){const before=new Map(prior.rows.map(r=>[r.id,r]));tables[name]={...prior,columns:[...new Set([...prior.columns,...data.columns])],rows:data.rows.map(r=>({...before.get(r.id),...r}))};}
      else tables[name]=data;
      return data;
    } finally {loading.delete(cacheKey);}
  }, getTable(name) {
    assertTablePermission(name,"read");
    if (fullTables.has(name)) return fullTables.get(name)!;
    if (loading.has(name) || loading.size >= 16) throw new Error(`สูตรข้ามตารางอ้างอิงวนกันที่ ${name} กรุณาแก้สูตร`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c => c.is_key)?.name || "id", label = labelTextColumn(cols);
    const raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id LIMIT 10001`).all() as Record<string, any>[];
    if (raw.length > 10000) throw new Error(`ตาราง ${name} มีข้อมูลเกิน 10,000 แถวสำหรับสูตรตัวเลือก`);
    loading.add(name);
    try {
      const rows = visibleRawRows(name,raw,database).map(r => calculateRow(cols, r, false, now, false, userEmail, context).row);
      const labels: Record<string, string> = Object.create(null),labelImages:Record<string,string>=Object.create(null),image=labelImageColumn(cols);
      for (const r of rows) if (r[key] != null) {labels[String(r[key])] = String(r[label] ?? r[key]);if(image&&typeof r[image]==="string"&&r[image])labelImages[String(r[key])]=r[image] as string;}
      const data = { columns: ["id", ...cols.map(c => c.name)], key, rows, labels, labelImages, refs: refTablesOf(cols), relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual)) };
      fullTables.set(name,data);
      return tables[name] = data;
    } finally { loading.delete(name); }
  } };
  return { ...context, snapshot(sources: string[], columns: Column[] = [], skipDenied=false) {
    const queue = sources.map(source => ({ source, columns })), loaded = new Set<string>();
    while (queue.length) {
      const { source, columns } = queue.shift()!; if (!source.trim()) continue;
      const targets = new Set(tableReferences(source,false).map(r => r.table));
      for (const related of relatedReferences(source)) {
        if(skipDenied&&!canRead(related.table))continue;
        context.getRelatedTable!(related.table,related.column);
      }
      for (const path of referencePaths(source)) {
        const owner = path.table ? columnsOf(path.table) : columns, ref = owner.find(c => c.name === path.column);
        if (!ref || ref.type !== "ref" || !ref.ref_table) throw new Error(`[${path.column}] ต้องเป็นชนิด Ref ก่อนดึง [${path.property}]`);
        targets.add(ref.ref_table);
      }
      for (const table of targets) {
        if(skipDenied&&!canRead(table))continue;
        if (loaded.has(table)) continue;
        loaded.add(table); context.getTable!(table);
        const columns = columnsOf(table);
        for (const c of columns) for (const field of FORMULA_FIELDS) if (c[field]) queue.push({ source: c[field]!, columns });
      }
    }
    return tables;
  } };
}
