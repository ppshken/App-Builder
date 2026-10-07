import {actionConfigExpressions} from "./action-config";
import { db, columnsOf } from "./db";
import { FORMULA_FIELDS, refTablesOf } from "./columns";
import { references, tableReferences, referencePaths, renameReference, renameDereference } from "./expression";
type StoredColumn = { table_name: string; name: string; label: string } & Record<string, string | null>;
export function referenceSchemas() {
  return Object.fromEntries((db.prepare("SELECT name FROM _tables").all() as {name:string}[]).map(t => [t.name, refTablesOf(columnsOf(t.name))]));
}
export function externalFormulaUse(table: string, column?: string): string | undefined {
  const schemas = referenceSchemas();
  if(column)for(const a of db.prepare("SELECT label,config_json FROM _actions WHERE kind='new_form'").all() as any[]){const config=JSON.parse(a.config_json||"{}");const target=db.prepare("SELECT table_name FROM _views WHERE name=?").get(config.view_name) as {table_name:string}|undefined;if(target?.table_name===table&&Object.hasOwn(config.initial_values||{},column))return 'ค่าตั้งต้นฟอร์มใน Action '+a.label;}
  for(const rule of db.prepare("SELECT * FROM _role_row_rules WHERE table_name=?").all(table) as any[])if(!column||references(rule.expression).includes(column))return "กฎสิทธิ์ระดับแถว กรุณาแก้กฎในหน้าบทบาทก่อน";
  const uses = (source: string, owner: string) => source.trim() && (tableReferences(source).some(r => r.table === table && (!column || r.column === column)) || referencePaths(source).some(p => schemas[p.table || owner]?.[p.column] === table && (!column || p.property === column)));
  for (const v of db.prepare("SELECT * FROM _views").all() as any[]) if ((column || v.table_name !== table) && uses(v.show_if || "", v.table_name)) return `Show_If ของ View ${v.label}`;
  const columns = db.prepare("SELECT * FROM _columns").all() as StoredColumn[];
  for (const c of columns) {
    if (c.table_name === table && (!column || c.name === column)) continue;
    if (FORMULA_FIELDS.some(f => uses(c[f] || "", c.table_name))) return `${c.table_name} · ${c.label}`;
  }
  for (const s of db.prepare("SELECT * FROM _slices").all() as any[]) if ((column || s.table_name !== table) && uses(s.filter_expr, s.table_name)) return `Slice ${s.label}`;
  for (const a of db.prepare("SELECT * FROM _actions").all() as any[]) if ((column || a.table_name !== table) && [a.condition_expr,...actionConfigExpressions(JSON.parse(a.config_json||"{}")), ...Object.values(JSON.parse(a.values_json))].some(s => uses(String(s), a.table_name))) return `Action ${a.label}`;
}
export function renameExternalFormulas(table: string, old: string, next: string) {
  const schemas = referenceSchemas();
  const rewrite = (source: string, owner: string) => renameReference(renameDereference(source, table, old, next, schemas[owner] || {}, schemas), old, next, table);
  for (const c of db.prepare("SELECT * FROM _columns").all() as StoredColumn[]) {
    for (const field of FORMULA_FIELDS) if (c[field]) {
      const source = rewrite(c[field]!, c.table_name);
      if (source !== c[field]) db.prepare(`UPDATE _columns SET ${field}=? WHERE table_name=? AND name=?`).run(source, c.table_name, c.name);
    }
  }
  for (const v of db.prepare("SELECT * FROM _views").all() as any[]) if (v.show_if) db.prepare("UPDATE _views SET show_if=? WHERE name=?").run(rewrite(v.show_if, v.table_name), v.name);
  for (const s of db.prepare("SELECT * FROM _slices").all() as any[]) db.prepare("UPDATE _slices SET filter_expr=? WHERE name=?").run(rewrite(s.filter_expr, s.table_name), s.name);
  for(const a of db.prepare("SELECT * FROM _actions").all() as any[]){const config=JSON.parse(a.config_json||"{}");for(const field of ["url_expr","row_expr"])if(config[field])config[field]=rewrite(a.table_name===table?renameReference(config[field],old,next):config[field],a.table_name);if(config.initial_values){const target=db.prepare("SELECT table_name FROM _views WHERE name=?").get(config.view_name) as {table_name:string}|undefined;config.initial_values=Object.fromEntries(Object.entries(config.initial_values).map(([key,expr])=>[target?.table_name===table&&key===old?next:key,rewrite(a.table_name===table?renameReference(String(expr),old,next):String(expr),a.table_name)]));}db.prepare("UPDATE _actions SET config_json=? WHERE name=?").run(JSON.stringify(config),a.name);}
  for(const r of db.prepare("SELECT * FROM _role_row_rules WHERE table_name=?").all(table) as any[])db.prepare("UPDATE _role_row_rules SET expression=? WHERE role_name=? AND table_name=? AND operation=?").run(renameReference(r.expression,old,next),r.role_name,table,r.operation);
  for (const a of db.prepare("SELECT * FROM _actions").all() as any[]) db.prepare("UPDATE _actions SET condition_expr=?,values_json=? WHERE name=?").run(rewrite(a.condition_expr, a.table_name), JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(a.values_json)).map(([k, expr]) => [k, rewrite(String(expr), a.table_name)]))), a.name);
}
