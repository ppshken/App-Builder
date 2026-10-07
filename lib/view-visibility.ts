import { formulaErrors, type FormulaSchema } from "./columns";
import { asBoolean, evaluateExpression, references, type ExpressionOptions } from "./expression";
// Views have no current row. SELECT still has its own candidate row context.
export function validateViewCondition(source: unknown, schema?: FormulaSchema): string {
  if (typeof source !== "string" || source.length > 10000) throw new Error("Show_If ต้องเป็นสูตรข้อความไม่เกิน 10,000 ตัวอักษร");
  const text = source.trim(); if (!text) return "";
  if (references(text).length) throw new Error("Show_If ของ View ไม่มีแถวปัจจุบัน ใช้ TODAY(), COUNT(table[key]) หรือ SELECT(table[key], เงื่อนไข) แทน [คอลัมน์]");
  const error = formulaErrors([{ name: "view_condition", label: "View", type: "text", show_if: text }], schema)["view_condition.show_if"];
  if (error) throw new Error(error);
  return text;
}
export function viewIsVisible(source: string | undefined, context: ExpressionOptions = {}) {
  return !source?.trim() || asBoolean(evaluateExpression(source, {}, context));
}
