import {fileFolder} from './file-storage';
import {assertPartColumn,assertPartSchema} from "./part-of-config";
import {imageFolder} from "./media-settings";
import { normalizeMaxLength, assertLabels, assertFormulas, assertIdentifier, Column, FORMULA_FIELDS, SQLTYPE, FormulaSchema } from "./columns";
import {assertUniqueColumn} from "./unique";
import { columnsOf, db, tableExists } from "./db";

export function normalizeColumns(input: unknown, overrides: FormulaSchema = {}): Column[] {
  if (!Array.isArray(input) || !input.length || input.length > 200) throw new Error("ตารางต้องมี 1–200 คอลัมน์");
  const seen = new Set<string>();
  const cols = input.map((raw, pos) => {
    if (!raw || typeof raw !== "object") throw new Error("ข้อมูลคอลัมน์ไม่ถูกต้อง");
    assertIdentifier(raw.name);
    if (seen.has(raw.name)) throw new Error(`คอลัมน์ "${raw.name}" ซ้ำ`);
    seen.add(raw.name);
    if (!Object.hasOwn(SQLTYPE, raw.type)) throw new Error("ชนิดข้อมูลไม่รองรับ");
    if(raw.gps_auto!==undefined&&![true,false,0,1].includes(raw.gps_auto))throw Error("ตำแหน่งปัจจุบันต้องเป็นค่าเปิดหรือปิด");
    if(raw.gps_auto&&(raw.type!=="latlong"||raw.is_virtual))throw Error("ตำแหน่งปัจจุบันใช้กับช่องพิกัดที่กรอกข้อมูลจริงเท่านั้น");
    if(raw.gps_auto&&typeof raw.default_expr==="string"&&raw.default_expr.trim())throw Error("ช่องตำแหน่งปัจจุบันไม่ใช้สูตรค่าเริ่มต้น กรุณาลบสูตรก่อนเปิด GPS");
    assertPartColumn(raw);
    if(raw.reset_on_edit!==undefined&&![true,false,0,1].includes(raw.reset_on_edit))throw Error("Reset On Edit ต้องเป็นค่าเปิดหรือปิด");
    const c: Column = {reset_on_edit:raw.reset_on_edit?1:0,reset_columns:raw.reset_columns??[],is_part_of:raw.is_part_of?1:0,part_show_if:raw.part_show_if?.trim()||null,part_add_if:raw.part_add_if?.trim()||null,part_valid_if:raw.part_valid_if?.trim()||null, max_length:normalizeMaxLength(raw.type,raw.max_length), gps_auto:raw.gps_auto?1:0,file_path:raw.type==='file'&&!raw.is_virtual?fileFolder(raw.file_path??''):null,image_path:raw.type==="image"?imageFolder(raw.image_path??""):null,name: raw.name, label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : raw.name,
      is_unique: raw.is_unique ? 1 : 0, is_editable: raw.is_virtual || raw.is_editable === 0 || raw.is_editable === false ? 0 : 1, type: raw.type, required: raw.required ? 1 : 0, pos, is_virtual: raw.is_virtual ? 1 : 0, is_key: raw.is_key ? 1 : 0, is_label: raw.is_label ? 1 : 0,
      options: ["enum", "enumlist"].includes(raw.type) && typeof raw.options === "string" ? [...new Set(raw.options.split(",").map((o: string) => o.trim()).filter(Boolean))].join(",") : null,
      ref_table: ["ref", "list", "enum", "enumlist"].includes(raw.type) ? raw.ref_table || null : null, list_limit: raw.list_limit ?? 5 };
    if(raw.is_unique!==undefined&&![true,false,0,1].includes(raw.is_unique))throw Error("ห้ามซ้ำต้องเป็นค่าเปิดหรือปิด");
    assertUniqueColumn(c);
    if (![0, 5, 10, 20].includes(c.list_limit!)) throw new Error("จำนวนรายการต่อหน้าต้องเป็น 5, 10, 20 หรือทั้งหมด");
    if (["enum", "enumlist"].includes(c.type) && !c.options && !c.ref_table && !(typeof raw.valid_if === "string" && raw.valid_if.trim())) throw new Error(`คอลัมน์ "${c.label}" ต้องระบุตัวเลือกหรือสูตร Valid_If ที่ให้รายการตัวเลือก`);
    if (c.is_key && (c.is_virtual || !["text", "longtext", "number", "decimal", "enum"].includes(c.type))) throw new Error("Key ต้องเป็นช่องข้อมูลชนิดข้อความ ตัวเลข หรือเลือกหนึ่งรายการ และเป็นช่องคำนวณไม่ได้");

    if (c.type === "ref" && !tableExists(c.ref_table!)) throw new Error(`คอลัมน์ "${c.label}" ต้องเลือกตารางอ้างอิงที่มีอยู่`);
    if (["list", "enum", "enumlist"].includes(c.type) && c.ref_table && !tableExists(c.ref_table)) throw new Error(`ไม่พบตารางอ้างอิงของ "${c.label}"`);
    for (const field of FORMULA_FIELDS) {
      if (raw[field] != null && typeof raw[field] !== "string") throw new Error("สูตรต้องเป็นข้อความ");
      c[field] = raw[field]?.trim() || null;
    }
    if (c.is_virtual) c.required = 0;
    return c;
  });
  if (cols.filter(c => c.is_key).length > 1) throw new Error("เลือก Key ได้เพียงหนึ่งคอลัมน์ต่อตาราง");
  assertLabels(cols);
  const schema = Object.fromEntries((db.prepare("SELECT name FROM _tables").all() as { name: string }[]).map(t => [t.name, columnsOf(t.name)]));
  const owner=Object.keys(overrides)[0]||"__new_table";
  assertFormulas(cols, { ...schema, ...overrides,[owner]:cols });
  assertPartSchema({...schema,[owner]:cols});
  return cols;
}
export function insertColumn(table: string, c: Column) {
  db.prepare(`INSERT INTO _columns(table_name,name,label,type,options,ref_table,required,pos,is_virtual,is_key,is_label,list_limit,is_editable,is_unique,image_path,file_path,gps_auto,max_length,is_part_of,part_show_if,part_add_if,part_valid_if,reset_on_edit,reset_columns_json,${FORMULA_FIELDS.join(",")}) VALUES(${Array(24 + FORMULA_FIELDS.length).fill("?").join(",")})`)
    .run(table, c.name, c.label, c.type, c.options ?? null, c.ref_table ?? null, c.required ? 1 : 0, c.pos ?? 0, c.is_virtual ? 1 : 0, c.is_key ? 1 : 0, c.is_label ? 1 : 0, c.list_limit ?? 5, c.is_editable === 0 || c.is_editable === false ? 0 : 1, c.is_unique ? 1 : 0, c.image_path||null, c.file_path||null, c.gps_auto?1:0, c.max_length??0,c.is_part_of?1:0,c.part_show_if||null,c.part_add_if||null,c.part_valid_if||null,c.reset_on_edit?1:0,JSON.stringify(c.reset_columns||[]), ...FORMULA_FIELDS.map(f => c[f] ?? null));
}
export function saveColumn(table: string, c: Column) {
  db.prepare(`UPDATE _columns SET label=?,options=?,ref_table=?,list_limit=?,required=?,is_key=?,is_label=?,is_editable=?,is_unique=?,image_path=?,file_path=?,gps_auto=?,max_length=?,is_part_of=?,part_show_if=?,part_add_if=?,part_valid_if=?,reset_on_edit=?,reset_columns_json=?,${FORMULA_FIELDS.map(f => `${f}=?`).join(",")} WHERE table_name=? AND name=?`)
    .run(c.label, c.options ?? null, c.ref_table ?? null, c.list_limit ?? 5, c.required ? 1 : 0, c.is_key ? 1 : 0, c.is_label ? 1 : 0, c.is_editable === 0 || c.is_editable === false ? 0 : 1, c.is_unique ? 1 : 0, c.image_path||null, c.file_path||null, c.gps_auto?1:0, c.max_length??0,c.is_part_of?1:0,c.part_show_if||null,c.part_add_if||null,c.part_valid_if||null,c.reset_on_edit?1:0,JSON.stringify(c.reset_columns||[]), ...FORMULA_FIELDS.map(f => c[f] ?? null), table, c.name);
}
export function assertKeyData(table: string, cols: Column[]) {
  const key = cols.find(c => c.is_key);
  if (!key) return;
  const rows = db.prepare(`SELECT "${key.name}" AS value FROM "t_${table}"`).all() as { value: unknown }[];
  const seen = new Set<unknown>();
  for (const { value } of rows) {
    if (value == null || (typeof value === "string" && !value.trim())) throw new Error(`ใช้ "${key.label}" เป็น Key ไม่ได้ มีข้อมูลว่างอยู่ กรุณากรอกให้ครบก่อน`);
    if (seen.has(value)) throw new Error(`ใช้ "${key.label}" เป็น Key ไม่ได้ มีค่าซ้ำอยู่ กรุณาแก้ข้อมูลก่อน`);
    seen.add(value);
  }
}
