import { asBoolean, evaluateExpression, isBlank, references, tableReferences, referencePaths, listSource, ExpressionContext, ExpressionOptions, Value } from "./expression";
import { normalizeCoordinates } from "./location";
import { normalizeDateTime } from "./datetime";

export const IDENT = /^[a-z][a-z0-9_]{0,40}$/;
export const SQLTYPE: Record<string, string> = { color:"TEXT",signature:"TEXT",file:"TEXT",text: "TEXT", longtext: "TEXT", number: "REAL", decimal: "REAL", date: "TEXT", datetime: "TEXT", image: "TEXT", latlong: "TEXT", yesno: "INTEGER", enum: "TEXT", enumlist: "TEXT", list: "TEXT", ref: "INTEGER" };
export const UNIQUE_TYPES = ["text","longtext","number","decimal","date","datetime","image","yesno","enum","ref"];
export const FORMULA_FIELDS = ["virtual_expr", "default_expr", "show_if", "valid_if", "required_if", "editable_if"] as const;
export type FormulaField = typeof FORMULA_FIELDS[number];
export type Column = {
  name: string; label: string; type: string; input_mode?: "button" | "dropdown" | null; button_limit?: number | null; reset_on_edit?:number|boolean; reset_columns?:string[]; max_length?:number; gps_auto?:number|boolean; image_path?:string|null; file_path?:string|null; options?: string | null; ref_table?: string | null;
  is_part_of?:number|boolean;part_show_if?:string|null;part_add_if?:string|null;part_valid_if?:string|null; required?: number | boolean; pos?: number; is_virtual?: number | boolean; is_key?: number | boolean; is_label?: number | boolean; list_limit?: number; is_unique?: number | boolean; is_editable?: number | boolean;
} & Partial<Record<FormulaField, string | null>>;
export const FORMULA_LABELS: Record<FormulaField, string> = {
  virtual_expr: "สูตรคำนวณ", default_expr: "ค่าเริ่มต้น", show_if: "แสดงเมื่อ (Show_If)",
  editable_if: "แก้ไขเมื่อ (Editable_If)", valid_if: "ค่าต้องผ่านเงื่อนไข (Valid_If)", required_if: "จำเป็นเมื่อ (Required_If)",
};
export const blankColumn = (): Column => ({ name: "", label: "", type: "text", options: "", ref_table: "", required: false,
  reset_on_edit:false,reset_columns:[],is_part_of:false,part_show_if:"",part_add_if:"",part_valid_if:"",max_length: 0, gps_auto: false, is_unique: false, is_editable: true, editable_if: "", is_virtual: false, virtual_expr: "", default_expr: "", show_if: "", valid_if: "", required_if: "" });
export function assertIdentifier(name: unknown): asserts name is string {
  if (typeof name !== "string" || !IDENT.test(name) || name === "id")
    throw new Error("ชื่อในระบบต้องขึ้นต้นด้วยอังกฤษพิมพ์เล็ก ตามด้วยอังกฤษพิมพ์เล็ก ตัวเลข หรือ _ ไม่เกิน 41 ตัว และห้ามใช้ id");
}
export type FormulaSchema = Record<string, { name: string; type: string; ref_table?: string | null }[]>;
export const refTablesOf = (cols: Column[]): Record<string, string> => Object.fromEntries(cols.filter(c => c.type === "ref" && c.ref_table).map(c => [c.name, c.ref_table!]));
export function formulaErrors(cols: Column[], schema?: FormulaSchema): Record<string, string> {
  const errors: Record<string, string> = {}, names = new Set(["id", ...cols.map(c => c.name)]);
  const graphs: Record<string, string[]> = Object.create(null);
  for (const c of cols) {
    if (c.is_virtual && !c.virtual_expr?.trim()) errors[`${c.name}.virtual_expr`] = "กรุณากรอกสูตรสำหรับช่องคำนวณ";
    if (c.is_virtual && c.default_expr?.trim()) errors[`${c.name}.default_expr`] = "ช่องคำนวณใช้ค่าเริ่มต้นไม่ได้ กรุณาลบสูตรค่าเริ่มต้น";
    if (!c.is_virtual && c.virtual_expr?.trim()) errors[`${c.name}.virtual_expr`] = "กรุณาเลือกช่องคำนวณก่อนใส่สูตรคำนวณ";
    for (const field of FORMULA_FIELDS) {
      const source = c[field];
      if (!source) continue;
      try {
        if (typeof source !== "string") throw new Error("สูตรต้องเป็นข้อความ");
        if (!source.trim()) continue;
        const refs = references(source);
        for (const n of refs) if (!names.has(n) && !(n === "_THIS" && field === "valid_if"))
          throw new Error(`ไม่พบคอลัมน์ [${n}] ใช้ชื่อในระบบ ไม่ใช่ชื่อที่แสดง`);
        if (schema) for (const ref of tableReferences(source)) {
          if (!Object.hasOwn(schema, ref.table)) throw new Error(`ไม่พบตาราง ${ref.table} กรุณาใช้ชื่อในระบบ`);
          if (ref.column !== "id" && !schema[ref.table].some(c => c.name === ref.column)) throw new Error(`ไม่พบคอลัมน์ [${ref.column}] ในตาราง ${ref.table}`);
        }
        for (const path of referencePaths(source)) {
          const owner = path.table ? schema?.[path.table] : cols;
          if (!owner) continue;
          const ref = owner.find(c => c.name === path.column);
          if (ref?.type !== "ref" || !ref.ref_table) throw new Error(`[${path.column}] ต้องเป็นชนิด Ref ก่อนดึง [${path.property}]`);
          if (schema && (!Object.hasOwn(schema, ref.ref_table) || (path.property !== "id" && !schema[ref.ref_table].some(c => c.name === path.property)))) throw new Error(`ไม่พบคอลัมน์ [${path.property}] ในตาราง ${ref.ref_table}`);
        }
        if ((c.is_virtual && field === "virtual_expr") || (!c.is_virtual && field === "default_expr")) graphs[c.name] = refs;
      } catch (e) { errors[`${c.name}.${field}`] = (e as Error).message; }
    }
  }
    try { assertResetConfig(cols); } catch(e) { errors.reset_on_edit=(e as Error).message; }
  for(const c of cols)if(c.reset_on_edit)graphs[c.name]=[...new Set([...(graphs[c.name]||[]),...(Array.isArray(c.reset_columns)?c.reset_columns:[])])];
  const done = new Set<string>(), visiting = new Set<string>();
  function check(name: string, path: string[]) {
    if (path.length >= 64) throw new Error("สูตรอ้างอิงต่อกันเกิน 64 ช่อง กรุณาลดการอ้างอิง");
    if (visiting.has(name)) throw new Error(`สูตรอ้างอิงวนกัน: ${[...path, name].map(n => `[${n}]`).join(" → ")} กรุณาตัดการอ้างอิงย้อนกลับ`);
    if (done.has(name) || !Object.hasOwn(graphs, name)) return;
    visiting.add(name);
    for (const ref of graphs[name]) check(ref, [...path, name]);
    visiting.delete(name); done.add(name);
  }
  for (const c of cols) {
    try { check(c.name, []); }
    catch (e) { errors[`${c.name}.${c.is_virtual ? "virtual_expr" : "default_expr"}`] = (e as Error).message; visiting.clear(); }
  }
  return errors;
}
export function assertFormulas(cols: Column[], schema?: FormulaSchema) {
  const errors = formulaErrors(cols, schema), first = Object.keys(errors)[0];
  if (first) {
    if(first === "reset_on_edit")throw new Error(errors[first]);
    const [name, field] = first.split(".");
    throw new Error(`คอลัมน์ "${cols.find(c => c.name === name)?.label || name}" — ${FORMULA_LABELS[field as FormulaField]}: ${errors[first]}`);
  }
}
export function normalizeValue(c: Column, value: unknown): Value {
  if (c.type === "list") {
    if (isBlank(value)) return [];
    let items = value;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch { throw new Error(`"${c.label}" ต้องเป็นรายการ เช่น ["ค่าแรก","ค่าที่สอง"]`); } }
    if (!Array.isArray(items) || items.length > 10000 || items.some(v => (typeof v !== "string" && typeof v !== "number") || (typeof v === "number" && !Number.isFinite(v)))) throw new Error(`"${c.label}" ต้องเป็นรายการข้อความหรือตัวเลข ไม่เกิน 10,000 รายการ`);
    return [...new Set(items.map(String))];
  }
  if (c.type === "enumlist") {
    if (isBlank(value)) return [];
    let items = value;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch { throw new Error(`"${c.label}" ต้องเป็นรายการตัวเลือก`); } }
    if (!Array.isArray(items) || items.length > 200 || items.some(v => typeof v !== "string")) throw new Error(`"${c.label}" ต้องเป็นรายการตัวเลือก`);
    const allowed = (c.options || "").split(",").map(v => v.trim());
    if (!c.valid_if?.trim() && !c.ref_table && items.some(v => !allowed.includes(v))) throw new Error(`"${c.label}" ต้องเลือกค่าจากรายการที่กำหนด`);
    return [...new Set(items as string[])];
  }
  if (isBlank(value)) return null;
  if (c.type === "number" || c.type === "decimal" || c.type === "ref") {
    if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && !value.trim()) || !Number.isFinite(Number(value)))
      throw new Error(`"${c.label}" ต้องเป็นตัวเลข`);
    const n = Number(value);
    if (c.type === "ref" && (!Number.isSafeInteger(n) || n < 1)) throw new Error(`"${c.label}" ต้องเลือกข้อมูลจากตารางอ้างอิง`);
    return n;
  }
  if (c.type === "yesno") {
    if (value === true || value === 1 || value === "1") return 1;
    if (value === false || value === 0 || value === "0") return 0;
    throw new Error(`"${c.label}" ต้องเป็นใช่หรือไม่ใช่`);
  }
  if (typeof value !== "string") throw new Error(`"${c.label}" ต้องเป็นข้อความ`);
  if (["text","longtext"].includes(c.type) && c.max_length && value.length > c.max_length) throw new Error(`"${c.label}" กรอกได้ไม่เกิน ${c.max_length} ตัวอักษร กรุณาลดข้อความก่อนบันทึก`);
  if(c.type === "latlong") { try { return normalizeCoordinates(value); } catch(e) { throw Error(`"${c.label}": ${(e as Error).message}`); } }
  if (c.type === "datetime") {
    try { return normalizeDateTime(value); } catch (e) { throw new Error(`"${c.label}": ${(e as Error).message}`); }
  }
  if (["image","signature"].includes(c.type) && !/^\/api\/images\/[a-f0-9-]{36}$/.test(value))
    throw new Error(`"${c.label}" ต้องเป็นรูปภาพที่อัปโหลด กรุณาเลือกรูปภาพ`);
  if(c.type === "color"){if(!/^#[a-f0-9]{6}$/i.test(value))throw Error('"'+c.label+'" ต้องเป็นโค้ดสี เช่น #2563EB');return value.toUpperCase();}
  if(c.type === "file"&&!/^\/api\/files\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value))throw Error('"'+c.label+'" ต้องเป็นไฟล์ที่อัปโหลด กรุณาเลือกไฟล์');
  if (c.type === "date") {
    const date = value.slice(0, 10), d = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date)
      throw new Error(`"${c.label}" ต้องเป็นวันที่ที่ถูกต้อง เช่น 2026-10-05`);
    return date;
  }
  if (c.type === "enum" && !!c.options?.trim() && !c.valid_if?.trim() && !c.ref_table && !(c.options || "").split(",").map(o => o.trim()).includes(value))
    throw new Error(`"${c.label}" ต้องเลือกค่าจากรายการที่กำหนด`);
  return value;
}
// SELECT still returns the requested values in ordinary expressions, Enum and EnumList.
// In a referenced List, its result carries row identity instead; conditions keep
// their ordinary values. IF/IFS propagate this only to the selected result branch.
export function evaluateColumnExpression(c: Column, source: string, row: Record<string, Value>, options: ExpressionOptions): Value {
  return normalizeValue(c,evaluateExpression(source,row,{...options,referenceListTable:c.type === "list" && c.ref_table ? c.ref_table : undefined}));
}
// Missing keys receive initial values only on insert/opening a new form. Explicit null stays empty.
export function calculateRow(cols: Column[], raw: Record<string, unknown>, defaults = false, now = new Date(), tolerant = false, userEmail = "", context: ExpressionContext = {}) {
  context = { ...context, refTables: refTablesOf(cols) };
  const row: Record<string, Value> = {}, errors: Record<string, string> = {}, byName = new Map(cols.map(c => [c.name, c]));
  const visiting = new Set<string>();
  function resolve(name: string): Value {
    if (name === "id") return (raw.id as Value) ?? null;
    if (Object.hasOwn(row, name)) return row[name];
    const c = byName.get(name);
    if (!c) throw new Error(`ไม่พบคอลัมน์ [${name}]`);
    if (visiting.has(name)) throw new Error(`สูตรอ้างอิงวนกันที่ [${name}]`);
    if (visiting.size >= 64) throw new Error("สูตรอ้างอิงต่อกันเกิน 64 ช่อง กรุณาลดการอ้างอิง");
    visiting.add(name);
    try {
      const source = c.is_virtual ? c.virtual_expr : defaults && !Object.hasOwn(raw, name) ? c.default_expr : null;
      const value = source?.trim() ? evaluateColumnExpression(c,source,{}, { ...context, now, resolve, userEmail }) : c.is_virtual ? null : raw[name];
      return row[name] = normalizeValue(c, value);
    } catch (e) {
      errors[name] = (e as Error).message;
      if (!tolerant) throw new Error(`คอลัมน์ "${c.label}": ${errors[name]}`);
      return row[name] = null;
    } finally { visiting.delete(name); }
  }
  for (const c of cols) resolve(c.name);
  if (Object.hasOwn(raw, "id")) row.id = raw.id as Value;
  return { row, errors };
}
export function formState(cols: Column[], raw: Record<string, unknown>, now = new Date(), userEmail = "", context: ExpressionContext = {}, original?: Record<string, unknown>) {
  context = { ...context, refTables: refTablesOf(cols) };
  const { row, errors } = calculateRow(cols, raw, false, now, true, userEmail, context);
  const before = original ? calculateRow(cols, original, false, now, true, userEmail, context).row : undefined;
  const visible: Record<string, boolean> = {}, required: Record<string, boolean> = {}, validation: Record<string, string> = {};
  const choices: Record<string, string[]> = {}, editable: Record<string, boolean> = {};
  for (const c of cols) {
    const condition = (field: FormulaField, fallback: boolean) => {
      try {
        if (!c[field]?.trim()) return fallback;
        const value = evaluateExpression(c[field]!, { id: null, ...row, _THIS: row[c.name] }, { ...context, now, userEmail, referenceListTable: field === "valid_if" && c.type === "list" && c.ref_table ? c.ref_table : undefined });
        if (field === "valid_if" && ["enum", "enumlist", "list", "ref"].includes(c.type) && Array.isArray(value)) {
          if (c.type === "ref" && value.some(v => (typeof v !== "string" && typeof v !== "number") || !String(v).trim() || !Number.isSafeInteger(Number(v)) || Number(v) < 1)) throw new Error("Valid_If ของ Ref ต้องคืนรายการ id ของตารางอ้างอิง เช่น SELECT(ตาราง[id], เงื่อนไข)");
          const allowed = c.type === "ref" ? value.map(v => String(Number(v))) : c.type === "list" ? normalizeValue(c,value) as string[] : c.type === "enum" ? value.filter(v=>v!==null).map(String) : value;
          choices[c.name] = [...new Set(allowed)];
          return ["enum", "ref"].includes(c.type) ? isBlank(row[c.name])||allowed.includes(String(row[c.name])) : Array.isArray(row[c.name]) && (row[c.name] as string[]).every(v => allowed.includes(v));
        }
        return asBoolean(value);
      }
      catch (e) { if (field === "valid_if" && c.type === "ref") choices[c.name] = []; errors[c.name] = `${FORMULA_LABELS[field]}: ${(e as Error).message}`; return fallback; }
    };
    editable[c.name] = !c.is_virtual && c.is_editable !== 0 && c.is_editable !== false;
    if (editable[c.name] && c.editable_if?.trim()) {
      try { editable[c.name] = asBoolean(evaluateExpression(c.editable_if, row, { ...context, now, userEmail })) && (!before || asBoolean(evaluateExpression(c.editable_if, before, { ...context, now, userEmail }))); }
      catch(e) { editable[c.name] = false; errors[c.name] = FORMULA_LABELS.editable_if + ": " + (e as Error).message; }
    }
    visible[c.name] = condition("show_if", true);
    required[c.name] = !c.is_virtual && (!!c.is_key || !!c.required || condition("required_if", false));
    if (!c.is_virtual && required[c.name] && isBlank(row[c.name])) validation[c.name] = `กรุณากรอก "${c.label}"${visible[c.name] ? "" : " (ช่องนี้ถูกซ่อน ให้ปรับเงื่อนไขแสดงช่องหรือค่าที่เกี่ยวข้อง)"}`;
    if (c.is_key && typeof row[c.name] === "string" && !(row[c.name] as string).trim()) validation[c.name] = `Key "${c.label}" ต้องไม่ว่าง`;
    if (!condition("valid_if", true) && !validation[c.name]) validation[c.name] = `"${c.label}" ไม่ผ่านเงื่อนไข Valid_If กรุณาตรวจค่าที่กรอก`;
    // A boolean Valid_If still uses the fixed options; a list Valid_If supplies its own options.
    if (["enum","enumlist"].includes(c.type) && !Object.hasOwn(choices, c.name) && (c.type!=="enum"||!!c.options?.trim()||!!c.ref_table)) {
      const data = c.ref_table ? (context.getTable ? context.getTable(c.ref_table) : context.tables?.[c.ref_table]) : undefined;
      choices[c.name] = c.ref_table ? [...new Set((data?.rows || []).map(r=>r[data!.key]).filter(v=>v!=null).map(String))] : (c.options || "").split(",").map(v => v.trim()).filter(Boolean);
      if ((c.type==="enum"&&!isBlank(row[c.name])&&!choices[c.name].includes(String(row[c.name])))||(Array.isArray(row[c.name]) && (row[c.name] as string[]).some(v => !choices[c.name].includes(v)))) validation[c.name] = `"${c.label}" ต้องเลือกค่าจากรายการที่กำหนด`;
    }
  }
  return { row, errors, visible, required, validation, choices, editable };
}
export function enumListLabel(c: Column, value: string, context: ExpressionContext): string {
  try {
    const source = c.ref_table ? { table: c.ref_table, column: "" } : listSource(c.valid_if || ""); if (!source) return value;
    const data = context.getTable ? context.getTable(source.table) : context.tables?.[source.table];
    if (data && c.type === "list") {
      const row = data.rows.find(row=>String(row.id)===value);
      if (row && row[data.key] != null) return data.labels[String(row[data.key])] ?? value;
    }
    if (data && (data.key === source.column || !!c.ref_table) && Object.hasOwn(data.labels, value)) return data.labels[value];
  } catch { /* A broken formula is reported by formState, while saved keys remain readable. */ }
  return value;
}
export function validateRow(cols: Column[], row: Record<string, unknown>, now = new Date(), userEmail = "", context: ExpressionContext = {}) {
  const state = formState(cols, row, now, userEmail, context);
  const error = Object.values(state.errors)[0] || Object.values(state.validation)[0];
  if (error) throw new Error(error);
  return state.row;
}

export function assertEditableChanges(cols: Column[], before: Record<string, unknown>, candidate: Record<string, unknown>, now = new Date(), userEmail = "", context: ExpressionContext = {}) {
  const state = formState(cols, candidate, now, userEmail, context, before);
  for (const c of cols.filter(c=>!c.is_virtual)) {
    if (JSON.stringify(normalizeValue(c,before[c.name])) !== JSON.stringify(normalizeValue(c,candidate[c.name])) && !state.editable[c.name]) throw new Error(`แก้ไข "${c.label}" ไม่ได้: ช่องนี้อ่านอย่างเดียวหรือไม่ผ่าน Editable_If กรุณาคงค่าเดิมและตรวจเงื่อนไขการแก้ไข`);
  }
  return state;
}
export function calculateInsertRow(cols: Column[], body: Record<string, unknown>, now = new Date(), userEmail = "", context: ExpressionContext = {}) {
  let input = Object.fromEntries(cols.filter(c=>!c.is_virtual && c.is_editable !== 0 && c.is_editable !== false && Object.hasOwn(body,c.name)).map(c=>[c.name,body[c.name]]));
  for (let pass=0;pass<=cols.length;pass++) {
    const {row}=calculateRow(cols,input,true,now,false,userEmail,context), state=formState(cols,row,now,userEmail,context), locked=cols.filter(c=>!c.is_virtual && !state.editable[c.name]);
    const next={...input};for(const c of locked)delete next[c.name];
    const baseline=calculateRow(cols,next,true,now,false,userEmail,context).row;
    for(const c of locked)if(Object.hasOwn(body,c.name) && JSON.stringify(normalizeValue(c,body[c.name]))!==JSON.stringify(baseline[c.name]))throw new Error(`กำหนดค่า "${c.label}" ไม่ได้: ช่องนี้อ่านอย่างเดียวหรือไม่ผ่าน Editable_If กรุณาใช้ค่าเริ่มต้นของระบบ`);
    if(Object.keys(next).length===Object.keys(input).length)return baseline;
    input=next;
  }
  throw new Error("เงื่อนไขการแก้ไขอ้างอิงวนกัน กรุณาตรวจ Editable_If");
}

// Row identity has one textual label and an optional image; formulas retain scalar labels.
export function labelTextColumn(cols:Column[]){return cols.find(c=>c.is_label&&c.type!=="image")?.name??cols.find(c=>["text","longtext"].includes(c.type))?.name??"id";}
export function labelImageColumn(cols:Column[]){return cols.find(c=>c.is_label&&c.type==="image")?.name;}
export function assertLabels(cols:Column[]){if(cols.some(c=>c.is_label&&["enumlist","list","ref","signature","file"].includes(c.type)))throw Error("Label ใช้กับช่องค่าเดียวหรือรูปภาพเท่านั้น");if(cols.filter(c=>c.is_label&&c.type!=="image").length>1)throw Error("เลือก Label ข้อความได้ 1 คอลัมน์ต่อตาราง");if(cols.filter(c=>c.is_label&&c.type==="image").length>1)throw Error("เลือก Label รูปภาพได้ 1 คอลัมน์ต่อตาราง");}
export function enumListImage(c:Column,value:string,context:ExpressionContext):string|undefined{try{const source=c.ref_table?{table:c.ref_table,column:""}:listSource(c.valid_if||"");if(!source)return;const data=context.getTable?context.getTable(source.table):context.tables?.[source.table];if(!data)return;const key=c.type==="list"?data.rows.find(r=>String(r.id)===value)?.[data.key]:data.key===source.column||c.ref_table?value:undefined;return key==null?undefined:data.labelImages?.[String(key)];}catch{return;}}

export function normalizeMaxLength(type:string,value:unknown):number {
  if (value == null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1000000) throw Error("จำนวนตัวอักษรสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000 (0 คือไม่จำกัด)");
  if (!["text","longtext"].includes(type) && value !== 0) throw Error("จำกัดจำนวนตัวอักษรได้เฉพาะ Text และ Longtext");
  return value;
}

export function assertResetConfig(cols:Column[]) {
  for(const c of cols) {
    if(c.reset_on_edit!==undefined&&![true,false,0,1].includes(c.reset_on_edit))throw Error('Reset On Edit ต้องเป็นค่าเปิดหรือปิด');
    if(c.reset_columns!==undefined&&(!Array.isArray(c.reset_columns)||c.reset_columns.length>200||c.reset_columns.some(n=>typeof n!=='string')))throw Error('คอลัมน์ที่เฝ้าดูต้องเป็นรายการชื่อคอลัมน์');
    const watched=c.reset_columns||[];
    if(new Set(watched).size!==watched.length)throw Error('คอลัมน์ที่เฝ้าดูซ้ำ กรุณาเลือกแต่ละคอลัมน์เพียงครั้งเดียว');
    for(const name of watched)if(name==='id'||name===c.name||!cols.some(col=>col.name===name&&!col.is_virtual))throw Error('Reset On Edit ของ "'+c.label+'": เลือกคอลัมน์จริงอื่นที่มีอยู่ในตาราง ห้ามเลือก id หรือตัวเอง');
    if(c.reset_on_edit&&(c.is_virtual||c.name==='id'||c.gps_auto))throw Error('Reset On Edit ใช้กับคอลัมน์ข้อมูลจริงที่มีสูตรค่าตั้งต้นเท่านั้น ไม่ใช้กับ id หรือ GPS อัตโนมัติ');
    if(c.reset_on_edit&&!c.default_expr?.trim())throw Error('กรุณากำหนดสูตรค่าเริ่มต้นก่อนเปิด Reset On Edit ของ "'+c.label+'"');
    if(c.reset_on_edit&&!watched.length)throw Error('กรุณาเลือกอย่างน้อย 1 คอลัมน์ที่เฝ้าดูสำหรับ "'+c.label+'"');
  }
}
export function editResetTriggered(c:Column,cols:Column[],before:Record<string,unknown>,after:Record<string,unknown>) {
  return !!c.reset_on_edit&&(c.reset_columns||[]).some(name=>{const watched=cols.find(col=>col.name===name);if(!watched)throw Error('ไม่พบคอลัมน์ที่เฝ้าดู ['+name+']');return JSON.stringify(normalizeValue(watched,before[name]))!==JSON.stringify(normalizeValue(watched,after[name]));});
}
export function applyEditResets(cols:Column[],before:Record<string,unknown>,after:Record<string,unknown>,now=new Date(),email='',context:ExpressionContext={}) {
  const row={...after},reset=new Set<string>(),ordered:Column[]=[],visited=new Set<string>(),visiting=new Set<string>();
  function visit(c:Column){if(visited.has(c.name))return;if(visiting.has(c.name))throw Error('Reset On Edit อ้างอิงวนกัน กรุณาแก้คอลัมน์ที่เฝ้าดูหรือสูตรค่าตั้งต้น');if(visiting.size>=64)throw Error("Reset On Edit อ้างอิงต่อกันเกิน 64 ช่อง กรุณาลดการอ้างอิง");visiting.add(c.name);
    const source=c.is_virtual?c.virtual_expr:c.default_expr;
    for(const name of [...(c.reset_on_edit?c.reset_columns||[]:[]),...(source?.trim()?references(source):[])]){const dependency=cols.find(col=>col.name===name);if(dependency)visit(dependency);}
    visiting.delete(c.name);visited.add(c.name);if(c.reset_on_edit)ordered.push(c);
  }
  for(const c of cols.filter(c=>c.reset_on_edit))visit(c);
  for(const c of ordered)if(editResetTriggered(c,cols,before,row)) {
    const input={...row};delete input[c.name];
    try{row[c.name]=calculateRow(cols,input,true,now,false,email,context).row[c.name];reset.add(c.name);}
    catch(e){throw Error('คำนวณใหม่ของ "'+c.label+'" ไม่ได้: '+(e as Error).message);}
  }
  return {row,reset};
}
