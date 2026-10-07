import {visibleRawRows} from "./row-access";
import {expressionUser} from "./user-settings";
import {assertTablePermission,canRead,currentUser} from "./permissions";
import { db } from "./db";
import type Database from "better-sqlite3";
import {readColumns} from "./schema";
import {IDENT} from "./columns";
import { labelTextColumn,labelImageColumn, calculateRow, FORMULA_FIELDS, Column, refTablesOf } from "./columns";
import { ExpressionContext, ExpressionTable, tableReferences, referencePaths } from "./expression";

// One bounded snapshot per request; never turn expression text into SQL.
export function expressionContext(now = new Date(), userEmail = "", database:Database.Database=db) {
  const columnsOf=(name:string)=>readColumns(database,name);
  const tableExists=(name:string)=>IDENT.test(name)&&name!=="id"&&!!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(name);
  const labelCol=(name:string)=>{const cols=columnsOf(name);return labelTextColumn(cols);};
  const tables: Record<string, ExpressionTable> = Object.create(null), loading = new Set<string>();
  const context: ExpressionContext = { ...expressionUser(currentUser()||null,database), getTable(name) {
    assertTablePermission(name,"read");
    if (Object.hasOwn(tables, name)) return tables[name];
    if (loading.has(name) || loading.size >= 16) throw new Error(`สูตรข้ามตารางอ้างอิงวนกันที่ ${name} กรุณาแก้สูตร`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c => c.is_key)?.name || "id", label = labelCol(name);
    const raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id LIMIT 10001`).all() as Record<string, any>[];
    if (raw.length > 10000) throw new Error(`ตาราง ${name} มีข้อมูลเกิน 10,000 แถวสำหรับสูตรตัวเลือก`);
    loading.add(name);
    try {
      const rows = visibleRawRows(name,raw,database).map(r => calculateRow(cols, r, false, now, false, userEmail, context).row);
      const labels: Record<string, string> = Object.create(null),labelImages:Record<string,string>=Object.create(null),image=labelImageColumn(cols);
      for (const r of rows) if (r[key] != null) {labels[String(r[key])] = String(r[label] ?? r[key]);if(image&&typeof r[image]==="string"&&r[image])labelImages[String(r[key])]=r[image] as string;}
      return tables[name] = { columns: ["id", ...cols.map(c => c.name)], key, rows, labels, labelImages, refs: refTablesOf(cols) };
    } finally { loading.delete(name); }
  } };
  return { ...context, snapshot(sources: string[], columns: Column[] = [], skipDenied=false) {
    const queue = sources.map(source => ({ source, columns })), loaded = new Set<string>();
    while (queue.length) {
      const { source, columns } = queue.shift()!; if (!source.trim()) continue;
      const targets = new Set(tableReferences(source).map(r => r.table));
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
