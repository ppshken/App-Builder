import { assertFormulas, type Column } from "./columns";

export const PART_FORMULA_FIELDS = ["part_show_if", "part_add_if", "part_valid_if"] as const;
export function assertPartColumn(c: Column) {
  if(c.related_required!==undefined&&![false,true,0,1].includes(c.related_required))throw Error("การบังคับรายการลูกต้องเป็นค่าเปิดหรือปิด");
  if(c.related_required&&(c.type!=="ref"||c.is_virtual||!c.ref_table))throw Error("บังคับรายการลูกใช้กับคอลัมน์ Ref จริงที่เลือกตารางแม่เท่านั้น");
  if(c.ref_delete_cascade!==undefined&&![false,true,0,1].includes(c.ref_delete_cascade))throw Error("ลบลูกตามแม่ต้องเป็นค่าเปิดหรือปิด");
  if(c.ref_delete_cascade&&(c.type!=="ref"||c.is_virtual||!c.ref_table))throw Error("ลบลูกตามแม่ใช้กับ Ref จริงที่เลือกตารางแม่เท่านั้น");
  if (c.is_part_of !== undefined && ![false, true, 0, 1].includes(c.is_part_of)) throw Error("Is a part of ต้องเป็นค่าเปิดหรือปิด");
  if (c.is_part_of && (c.type !== "ref" || c.is_virtual || !c.ref_table)) throw Error("Is a part of ใช้กับ Ref ที่เก็บข้อมูลจริงและเลือกตารางแม่เท่านั้น");
  for (const field of PART_FORMULA_FIELDS) {
    if (c[field] != null && (typeof c[field] !== "string" || c[field]!.length > 10000)) throw Error("เงื่อนไขรายการลูกต้องเป็นข้อความสูตรไม่เกิน 10,000 ตัวอักษร");
  }
}
export function assertPartSchema(schema: Record<string, Column[]>) {
  for (const [table, cols] of Object.entries(schema)) {
    if (cols.filter(c => c.is_part_of).length > 1) throw Error("ตารางลูกเลือก Is a part of ได้เพียงหนึ่งคอลัมน์");
    for (const c of cols) {
      assertPartColumn(c);
      if (!c.is_part_of) continue;
      const parent = c.ref_table!;
      if (!schema[parent]) throw Error("ไม่พบตารางแม่ของ Is a part of");
      for (const field of PART_FORMULA_FIELDS) {
        if (!c[field]?.trim()) continue;
        // These conditions run in the parent row; _THIS is the child ID list.
        const probe = schema[parent].map((col, i) => ({...col, is_virtual: false, reset_on_edit: false, reset_columns: [],
          virtual_expr: "", default_expr: "", required_if: "", editable_if: "",
          show_if: i === 0 && field !== "part_valid_if" ? c[field] : "",
          valid_if: i === 0 && field === "part_valid_if" ? c[field] : ""}));
        assertFormulas(probe, schema);
      }
      let current = parent;
      const seen = new Set([table]);
      while (current) {
        if (seen.has(current)) throw Error("Is a part of อ้างอิงวนกัน กรุณาเลือกตารางแม่ที่ไม่ย้อนกลับมาที่ตารางลูก");
        seen.add(current);
        current = schema[current]?.find(col => col.is_part_of)?.ref_table || "";
      }
    }
  }
}
