import { SQLTYPE } from "./columns";

export function isAiSchemaRequest(question: string) {
  const text = question.trim();
  return /^(?:(?:ช่วย(?:ทำการ)?|ขอให้|ลอง|กรุณา|อยากให้|ผมอยากให้)\s*)*(?:สร้าง|เพิ่ม|แก้ไข|แก้|เปลี่ยน|ตั้งค่า|ตั้ง|กำหนด|เปิด|ปิด|ลบ|ย้าย|แปลง)[^\n]{0,100}(?:ตาราง|คอลัมน์|บังคับกรอก|valid[_ ]?if|ref\b)/i.test(text) ||
    /^(?:please\s+)?(?:create|add|edit|update|change|convert|set|rename|delete|drop|retarget)\b[^\n]{0,100}\b(?:table|tables|column|columns|schema|ref)\b/i.test(text) ||
    /^ในตาราง[^\n]{1,100}(?:ตั้ง|เพิ่ม|แก้|เปลี่ยน|กำหนด|เปิด|ปิด|ลบ|ย้าย|แปลง).*(?:valid[_ ]?if|คอลัมน์|ค่าเริ่มต้น|ref\b)/i.test(text);
}

export function aiDataDesignStatus(hasDesign: boolean, development: boolean, rejected: boolean) {
  if (hasDesign) return development
    ? "แผนพร้อมให้ตรวจสอบ กดยืนยันเพื่อนำไปใช้ในพื้นที่พัฒนาโครงสร้าง"
    : "แสดงตัวอย่างแผนแล้ว เปิดพื้นที่พัฒนาโครงสร้างและส่งคำสั่งอีกครั้งเพื่อนำไปใช้";
  return rejected
    ? "แผนไม่ผ่านการตรวจของระบบ กรุณาตรวจชื่อในระบบ ชนิดคอลัมน์ และตารางอ้างอิง แล้วลองใหม่"
    : "ยังไม่ได้แผนที่นำไปใช้ได้ กรุณาระบุชื่อตาราง คอลัมน์ และสิ่งที่ต้องการเปลี่ยนให้ชัดเจน แล้วลองใหม่";
}

type DesignColumn = { name: string; label: string; type: string; required: boolean; ref: string | null; formula?: string };
type DesignChange =
  | { kind: "add_column"; table: string; column: DesignColumn }
  | { kind: "rename_label"; table: string; column: string; label: string }
  | { kind: "edit_formula"; table: string; column: string; formula: string; previousFormula?: string }
  | { kind: "edit_default"; table: string; column: string; formula: string; previousFormula?: string }
  | { kind: "edit_validation"; table: string; column: string; formula: string; previousFormula?: string; message?: string; previousMessage?: string }
  | { kind: "set_label"; table: string; column: string };
export type AiDataDesign = {
  tables: { name: string; label: string; columns: DesignColumn[] }[];
  changes?: DesignChange[];
  conversion?: { table: string; column: string; type: string; ref: string | null; options?: string };
  requirement?: { table: string; column: string; required: boolean };
};
export const aiFormulaField = (kind: "edit_formula" | "edit_default" | "edit_validation") =>
  kind === "edit_formula" ? "virtual_expr" : kind === "edit_default" ? "default_expr" : "valid_if";
export type AiRequirementReview = { total: number; invalid: number; sampleIds: number[]; conditional: boolean; fingerprint: string };

const identifier = /^[a-z][a-z0-9_]{0,40}$/;
const validName = (value: unknown): value is string => typeof value === "string" && value !== "id" && identifier.test(value);
const validLabel = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 100;

export function aiDataDesign(value: unknown, existing: ReadonlySet<string>, visible: ReadonlySet<string>, editable: ReadonlyMap<string, ReadonlySet<string>> = new Map()): AiDataDesign | null {
  const proposal = value as { tables?: unknown; changes?: unknown; conversion?: unknown; requirement?: unknown } | null;
  const tables = proposal?.tables;
  const changes = proposal?.changes ?? [];
  if (!Array.isArray(tables) || tables.length > 5 || !Array.isArray(changes) || changes.length > 10) return null;
  if (proposal?.requirement != null) {
    const {table,column,required} = proposal.requirement as NonNullable<AiDataDesign["requirement"]>;
    if (proposal.conversion != null || tables.length || changes.length || !validName(table) || !validName(column) ||
        !editable.get(table)?.has(column) || typeof required !== "boolean") return null;
    return {tables:[],requirement:{table,column,required}};
  }
  if (proposal?.conversion != null) {
    const {table,column,type,ref = null,options} = proposal.conversion as NonNullable<AiDataDesign["conversion"]>;
    if (tables.length || changes.length || !validName(table) || !validName(column) || !editable.get(table)?.has(column) ||
        typeof type !== "string" || !Object.hasOwn(SQLTYPE,type) ||
        (type === "ref" ? typeof ref !== "string" || !visible.has(ref) : ref !== null) ||
        (options != null && (!["enum","enumlist"].includes(type) || typeof options !== "string" || options.length > 2000))) return null;
    return {tables:[],conversion:{table,column,type,ref,...(options ? {options:options.trim()} : {})}};
  }
  if (!tables.length && !changes.length) return null;
  const names = new Set<string>();
  for (const table of tables) {
    if (!table || !validName(table.name) || !validLabel(table.label) || names.has(table.name) ||
        existing.has(table.name) || !Array.isArray(table.columns) || !table.columns.length || table.columns.length > 8) return null;
    names.add(table.name);
  }
  const normalizeColumn = (column: DesignColumn | null): DesignColumn | null => {
    if (!column || !validName(column.name) || !validLabel(column.label) ||
        typeof column.type !== "string" || !Object.hasOwn(SQLTYPE,column.type) || typeof column.required !== "boolean") return null;
    const ref = column.ref ?? null;
    if (column.type === "ref" ? typeof ref !== "string" || !names.has(ref) && !visible.has(ref) : ref !== null) return null;
    const formula = column.formula;
    if (formula != null && (typeof formula !== "string" || !formula.trim() || formula.length > 4000 || column.required)) return null;
    return { name: column.name, label: column.label.trim(), type: column.type, required: column.required, ref,
      ...(formula ? {formula:formula.trim()} : {}) };
  };
  const result: AiDataDesign["tables"] = [];
  for (const table of tables) {
    const columns: AiDataDesign["tables"][number]["columns"] = [];
    const seen = new Set<string>();
    for (const raw of table.columns) {
      const column = normalizeColumn(raw);
      if (!column || seen.has(column.name)) return null;
      seen.add(column.name);
      columns.push(column);
    }
    result.push({ name: table.name, label: table.label.trim(), columns });
  }
  const edits: DesignChange[] = [];
  const targets = new Set<string>();
  for (const change of changes) {
    const fields = editable.get(change?.table);
    if (!fields) return null;
    if (change.kind === "add_column") {
      const column = normalizeColumn(change.column);
      if (!column || fields.has(column.name) || column.required || targets.has(change.table + "." + column.name)) return null;
      targets.add(change.table + "." + column.name);
      edits.push({ kind: "add_column", table: change.table, column });
    } else if ((change.kind === "edit_formula" || change.kind === "edit_default" || change.kind === "edit_validation") && validName(change.column) && fields.has(change.column)) {
      const {formula,previousFormula} = change;
      const target = change.table + "." + change.column;
      if (targets.has(target) || typeof formula !== "string" || !formula.trim() || formula.length > 4000 ||
          (previousFormula !== undefined && (typeof previousFormula !== "string" || previousFormula.length > 40000))) return null;
      targets.add(target);
      if (change.kind === "edit_validation") {
        const {message,previousMessage} = change;
        if (message != null && (typeof message !== "string" || message.length > 1000) ||
            previousMessage !== undefined && (typeof previousMessage !== "string" || previousMessage.length > 1000)) return null;
        edits.push({kind:change.kind, table:change.table, column:change.column, formula:formula.trim(), previousFormula,
          ...(typeof message === "string" ? {message:message.trim(),previousMessage} : {})});
      } else edits.push({kind:change.kind, table:change.table, column:change.column, formula:formula.trim(), previousFormula});
    } else if ((change.kind === "set_label" || change.kind === "rename_label" && validLabel(change.label)) && validName(change.column) && fields.has(change.column)) {
      const target = change.table + "." + (change.kind === "set_label" ? "@label" : change.column);
      if (targets.has(target)) return null;
      targets.add(target);
      edits.push(change.kind === "set_label"
        ? { kind: change.kind, table: change.table, column: change.column }
        : { kind: change.kind, table: change.table, column: change.column, label: change.label.trim() });
    } else return null;
  }
  return { tables: result, ...(edits.length ? { changes: edits } : {}) };
}
