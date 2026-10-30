import {normalizeAutoNumber,assertAutoNumberColumn} from './auto-number';
import {assertScanColumn} from './barcode';
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
    if(raw.related_required!==undefined&&![true,false,0,1].includes(raw.related_required))throw Error("การบังคับรายการลูกต้องเป็นค่าเปิดหรือปิด");
    if(raw.related_required&&(raw.type!=="ref"||raw.is_virtual))throw Error("บังคับรายการลูกใช้กับคอลัมน์ Ref จริงเท่านั้น");
    if(raw.ref_delete_cascade!==undefined&&![true,false,0,1].includes(raw.ref_delete_cascade))throw Error("ลบลูกตามแม่ต้องเป็นค่าเปิดหรือปิด");
    if(raw.ref_delete_cascade&&(raw.type!=="ref"||raw.is_virtual))throw Error("ลบลูกตามแม่ใช้กับคอลัมน์ Ref จริงเท่านั้น");
    if(raw.ref_allow_add!==undefined&&![true,false,0,1].includes(raw.ref_allow_add))throw Error("การเพิ่มข้อมูลอ้างอิงต้องเป็นค่าเปิดหรือปิด");
    if(raw.ref_allow_add&&(raw.type!=="ref"||raw.is_virtual))throw Error("เพิ่มข้อมูลอ้างอิงใช้กับคอลัมน์ Ref ที่กรอกข้อมูลจริงเท่านั้น");
    assertScanColumn(raw);assertPartColumn(raw);
    if(raw.reset_on_edit!==undefined&&![true,false,0,1].includes(raw.reset_on_edit))throw Error("Reset On Edit ต้องเป็นค่าเปิดหรือปิด");
    if(raw.input_mode!=null&&!["button","dropdown"].includes(raw.input_mode))throw Error("Input mode ไม่ถูกต้อง");
    if(raw.button_limit!=null&&(!Number.isInteger(raw.button_limit)||raw.button_limit<1||raw.button_limit>5))throw Error("จำนวนปุ่มต้องเป็น 1–5 รายการ");
    const c: Column = {scan_enabled:raw.scan_enabled?1:0,related_required:raw.related_required?1:0,ref_delete_cascade:raw.ref_delete_cascade?1:0,ref_allow_add:raw.ref_allow_add?1:0,input_mode:["enum","enumlist","ref"].includes(raw.type)?raw.input_mode??"dropdown":null,button_limit:["enum","enumlist","ref"].includes(raw.type)?raw.button_limit??5:null,reset_on_edit:raw.reset_on_edit?1:0,reset_columns:raw.reset_columns??[],is_part_of:raw.is_part_of?1:0,part_show_if:raw.part_show_if?.trim()||null,part_add_if:raw.part_add_if?.trim()||null,part_valid_if:raw.part_valid_if?.trim()||null, max_length:normalizeMaxLength(raw.type,raw.max_length), gps_auto:raw.gps_auto?1:0,file_path:raw.type==='file'&&!raw.is_virtual?fileFolder(raw.file_path??''):null,image_path:raw.type==="image"?imageFolder(raw.image_path??""):null,name: raw.name, label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : raw.name,
      is_unique: raw.is_unique ? 1 : 0, is_editable: raw.is_virtual || raw.is_editable === 0 || raw.is_editable === false ? 0 : 1, type: raw.type, required: raw.required ? 1 : 0, pos, is_virtual: raw.is_virtual ? 1 : 0, is_key: raw.is_key ? 1 : 0, is_label: raw.is_label ? 1 : 0,
      options: ["enum", "enumlist"].includes(raw.type) && typeof raw.options === "string" ? [...new Set(raw.options.split(",").map((o: string) => o.trim()).filter(Boolean))].join(",") : null,
      ref_table: ["ref", "list", "enum", "enumlist"].includes(raw.type) ? raw.ref_table || null : null, list_limit: raw.list_limit ?? 5 };
    if(raw.is_unique!==undefined&&![true,false,0,1].includes(raw.is_unique))throw Error("ห้ามซ้ำต้องเป็นค่าเปิดหรือปิด");
    assertUniqueColumn(c);
    if (![0, 5, 10, 20].includes(c.list_limit!)) throw new Error("จำนวนรายการต่อหน้าต้องเป็น 5, 10, 20 หรือทั้งหมด");
    if (c.type === "enumlist" && !c.options && !c.ref_table && !(typeof raw.valid_if === "string" && raw.valid_if.trim())) throw new Error(`คอลัมน์ "${c.label}" ต้องระบุตัวเลือก เลือกตารางอ้างอิง หรือใช้สูตรดึงตัวเลือกอย่างใดอย่างหนึ่ง · ไม่บังคับ Valid_If`);
    if (c.is_key && (c.is_virtual || !["text", "longtext", "number", "decimal", "enum"].includes(c.type))) throw new Error("Key ต้องเป็นช่องข้อมูลชนิดข้อความ ตัวเลข หรือเลือกหนึ่งรายการ และเป็นช่องคำนวณไม่ได้");

    if(c.ref_table&&(db.prepare('SELECT source_kind FROM _tables WHERE name=?').get(c.ref_table) as {source_kind:string}|undefined)?.source_kind==='EXTERNAL_REST_API')throw Error('Ref/List/Enum ไป Live API ยังไม่รองรับ กรุณา Import หรือ Sync ก่อน');
    if (c.type === "ref" && !tableExists(c.ref_table!)) throw new Error(`คอลัมน์ "${c.label}" ต้องเลือกตารางอ้างอิงที่มีอยู่`);
    if (["list", "enum", "enumlist"].includes(c.type) && c.ref_table && !tableExists(c.ref_table)) throw new Error(`ไม่พบตารางอ้างอิงของ "${c.label}"`);
    for (const field of FORMULA_FIELDS) {
      if (raw[field] != null && typeof raw[field] !== "string") throw new Error("สูตรต้องเป็นข้อความ");
      c[field] = raw[field]?.trim() || null;
    }
    c.auto_number=normalizeAutoNumber(raw.auto_number,c);if(c.auto_number){c.is_editable=0;c.is_unique=1;}assertAutoNumberColumn(c);
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
  db.prepare(`INSERT INTO _columns(table_name,name,label,type,options,ref_table,required,pos,is_virtual,is_key,is_label,list_limit,is_editable,is_unique,image_path,file_path,gps_auto,max_length,is_part_of,part_show_if,part_add_if,part_valid_if,reset_on_edit,reset_columns_json,input_mode,button_limit,ref_allow_add,ref_delete_cascade,related_required,scan_enabled,auto_number_json,${FORMULA_FIELDS.join(",")}) VALUES(${Array(31 + FORMULA_FIELDS.length).fill("?").join(",")})`)
    .run(table, c.name, c.label, c.type, c.options ?? null, c.ref_table ?? null, c.required ? 1 : 0, c.pos ?? 0, c.is_virtual ? 1 : 0, c.is_key ? 1 : 0, c.is_label ? 1 : 0, c.list_limit ?? 5, c.is_editable === 0 || c.is_editable === false ? 0 : 1, c.is_unique ? 1 : 0, c.image_path||null, c.file_path||null, c.gps_auto?1:0, c.max_length??0,c.is_part_of?1:0,c.part_show_if||null,c.part_add_if||null,c.part_valid_if||null,c.reset_on_edit?1:0,JSON.stringify(c.reset_columns||[]), c.input_mode??null,c.button_limit??null,c.ref_allow_add?1:0,c.ref_delete_cascade?1:0,c.related_required?1:0,c.scan_enabled?1:0,JSON.stringify(c.auto_number??null), ...FORMULA_FIELDS.map(f => c[f] ?? null));
}
export function saveColumn(table: string, c: Column) {
  db.prepare(`UPDATE _columns SET label=?,options=?,ref_table=?,list_limit=?,required=?,is_key=?,is_label=?,is_editable=?,is_unique=?,image_path=?,file_path=?,gps_auto=?,max_length=?,is_part_of=?,part_show_if=?,part_add_if=?,part_valid_if=?,reset_on_edit=?,reset_columns_json=?,input_mode=?,button_limit=?,ref_allow_add=?,ref_delete_cascade=?,related_required=?,scan_enabled=?,auto_number_json=?,${FORMULA_FIELDS.map(f => `${f}=?`).join(",")} WHERE table_name=? AND name=?`)
    .run(c.label, c.options ?? null, c.ref_table ?? null, c.list_limit ?? 5, c.required ? 1 : 0, c.is_key ? 1 : 0, c.is_label ? 1 : 0, c.is_editable === 0 || c.is_editable === false ? 0 : 1, c.is_unique ? 1 : 0, c.image_path||null, c.file_path||null, c.gps_auto?1:0, c.max_length??0,c.is_part_of?1:0,c.part_show_if||null,c.part_add_if||null,c.part_valid_if||null,c.reset_on_edit?1:0,JSON.stringify(c.reset_columns||[]), c.input_mode??null,c.button_limit??null,c.ref_allow_add?1:0,c.ref_delete_cascade?1:0,c.related_required?1:0,c.scan_enabled?1:0,JSON.stringify(c.auto_number??null), ...FORMULA_FIELDS.map(f => c[f] ?? null), table, c.name);
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
