import { db, columnsOf } from "./db";
import { normalizeColumns } from "./metadata";
import { FORMULA_FIELDS, type FormulaField } from "./columns";
import { aiFormulaField, isAiFormulaEdit, type AiDataDesign } from "./ai-data-design";

type Field = FormulaField | "label" | "invalid_value_error";
type Change = {table:string; column:string; uid:string; type:string; ref:string|null; field:Field; before:string|null; after:string|null};
const allowedFields = new Set<string>([...FORMULA_FIELDS,"label","invalid_value_error"]);
function identity(table:string,column:string) {
  return (db.prepare("SELECT uid FROM _development_objects WHERE kind='column' AND table_name=? AND name=? AND retired=0")
    .get(table,column) as {uid:string}|undefined)?.uid;
}

export function captureAiUndo(design:AiDataDesign) {
  if (design.tables.length || design.views?.length || design.actions?.length || !design.changes?.length ||
      design.changes.some(change => change.kind !== "rename_label" && !isAiFormulaEdit(change))) return [];
  const items: Change[] = [];
  for (const change of design.changes) {
    if (change.kind !== "rename_label" && !isAiFormulaEdit(change)) return [];
    const source = columnsOf(change.table).find(item => item.name === change.column);
    const uid = identity(change.table,change.column);
    if (!source || !uid) return [];
    const field = change.kind === "rename_label" ? "label" : aiFormulaField(change.kind);
    const append = (key:Field, after:string|null) => {
      const before = source[key] ?? null;
      if (before !== after) items.push({table:change.table,column:change.column,uid,type:source.type,ref:source.ref_table || null,field:key,before,after});
    };
    append(field,change.kind === "rename_label" ? change.label : change.formula || null);
    if (change.kind === "edit_validation" && change.message !== undefined) append("invalid_value_error",change.message || null);
  }
  return items;
}

export function saveAiUndo(planId:string, changes:Change[]) {
  if (!changes.length) return;
  db.exec("CREATE TABLE IF NOT EXISTS _ai_plan_undo (plan_id TEXT PRIMARY KEY,payload TEXT NOT NULL,reverted_at INTEGER)");
  db.prepare("INSERT INTO _ai_plan_undo(plan_id,payload) VALUES(?,?)").run(planId,JSON.stringify(changes));
}

export function aiUndoState(planId:string): {canUndo:boolean;revertedAt:number|null} {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='_ai_plan_undo'").get()) return {canUndo:false,revertedAt:null};
  const row = db.prepare("SELECT reverted_at FROM _ai_plan_undo WHERE plan_id=?").get(planId) as {reverted_at:number|null}|undefined;
  return {canUndo:!!row && row.reverted_at === null,revertedAt:row?.reverted_at ?? null};
}

export function undoAiPlan(planId:string, editable:ReadonlyMap<string,ReadonlySet<string>>) {
  return db.transaction(() => {
    const state = aiUndoState(planId);
    if (state.revertedAt) return state;
    if (!state.canUndo) throw Error("แผนนี้ยังไม่รองรับการย้อนกลับ");
    const row = db.prepare("SELECT payload FROM _ai_plan_undo WHERE plan_id=?").get(planId) as {payload:string};
    const changes = JSON.parse(row.payload) as Change[];
    for (const change of changes) {
      const source = columnsOf(change.table).find(item => item.name === change.column);
      if (!allowedFields.has(change.field) || !editable.get(change.table)?.has(change.column) || !source ||
          identity(change.table,change.column) !== change.uid || source.type !== change.type ||
          (source.ref_table || null) !== change.ref || (source[change.field] ?? null) !== change.after)
        throw Error("คอลัมน์หรือสิทธิ์เปลี่ยนหลังบันทึก กรุณาตรวจการตั้งค่าปัจจุบันก่อนย้อน");
    }
    for (const table of new Set(changes.map(change => change.table))) {
      const revised = columnsOf(table).map(column => {
        const overrides = changes.filter(change => change.table === table && change.column === column.name);
        return {...column,...Object.fromEntries(overrides.map(change => [change.field,change.before]))};
      });
      normalizeColumns(revised,{[table]:[]});
      for (const change of changes.filter(change => change.table === table)) {
        db.prepare(`UPDATE _columns SET ${change.field}=? WHERE table_name=? AND name=?`).run(change.before,table,change.column);
      }
    }
    const revertedAt = Date.now();
    db.prepare("UPDATE _ai_plan_undo SET reverted_at=? WHERE plan_id=?").run(revertedAt,planId);
    return {canUndo:false,revertedAt};
  })();
}
