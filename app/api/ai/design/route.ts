import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-api";
import { bad, errorMessage, readBody } from "@/lib/api";
import { currentDevelopment } from "@/lib/development-context";
import { currentApplication, withApplication } from "@/lib/application-context";
import { aiDataDesign, aiFormulaField, type AiRequirementReview } from "@/lib/ai-data-design";
import { dataDesignSchema } from "@/lib/ai-data-design-schema";
import { addBuilderColumn, createBuilderTable } from "@/lib/table-builder";
import { columnsOf, db } from "@/lib/db";
import { assertLabels, normalizeValue } from "@/lib/columns";
import { isBlank } from "@/lib/expression";
import { createHash } from "node:crypto";
import { formulaTypeCheck } from "@/lib/formula-result-type";
import { normalizeColumns } from "@/lib/metadata";

type DesignColumn = NonNullable<ReturnType<typeof aiDataDesign>>["tables"][number]["columns"][number];

function addDesignColumn(table: string, column: DesignColumn, visible: ReadonlySet<string>) {
  const { formula, ref, ...definition } = column;
  if (!formula) return addBuilderColumn(table, {...definition, ref_table:ref});
  const columns = columnsOf(table);
  const schemas = [...visible].map(name => ({name, columns:columnsOf(name)}));
  const candidate = {...definition, ref_table:ref, is_virtual:1, virtual_expr:formula};
  const check = formulaTypeCheck(formula, candidate, "virtual_expr", [...columns, candidate], schemas);
  if (check.error) throw Error(check.error);
  return addBuilderColumn(table, candidate);
}

export const POST = withAuth(async (request: Request) => {
  const development = currentDevelopment();
  const application = currentApplication();
  if (!development || !application) return bad("เปิดพื้นที่พัฒนาโครงสร้างก่อนนำแบบร่างไปใช้", 409);
  try {
    const body = await readBody(request);
    if (body.workspace !== development.id) return bad("พื้นที่พัฒนาเปลี่ยน กรุณาสร้างแบบร่างใหม่ในพื้นที่ปัจจุบัน", 409);
    const schema = dataDesignSchema();
    const design = aiDataDesign(body.design, schema.existing, schema.visible, schema.editable);
    if (!design) return bad("แผนไม่ตรงกับโครงสร้างปัจจุบัน กรุณาตรวจสิทธิ์และสร้างแบบร่างใหม่", 409);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    if (design.requirement) {
      const { table, column, required } = design.requirement;
      return db.transaction(() => {
        const source = columnsOf(table).find(item => item.name === column);
        if (!source || source.is_virtual || source.is_key || !!source.required === required)
          return bad("คอลัมน์นี้เปลี่ยนการบังคับกรอกตามแผนไม่ได้ กรุณาตรวจโครงสร้างปัจจุบัน", 409);
        const hash = createHash("sha256").update(JSON.stringify([development.id, table, source, required]));
        const review: AiRequirementReview = {
          total: 0, invalid: 0, sampleIds: [], conditional: !!source.required_if?.trim(), fingerprint: "",
        };
        const rows = required ? db.prepare(`SELECT id,"${column}" AS value FROM "t_${table}" ORDER BY id`).iterate() : [];
        if (!required) review.total = (db.prepare(`SELECT COUNT(*) AS total FROM "t_${table}"`).get() as {total:number}).total;
        for (const row of rows as Iterable<{id:number;value:unknown}>) {
          review.total++;
          let valid = false;
          try { valid = !isBlank(normalizeValue(source, row.value)); } catch { /* Invalid stored values need review. */ }
          if (valid) continue;
          review.invalid++;
          hash.update(String(row.id) + ",");
          if (review.sampleIds.length < 10) review.sampleIds.push(row.id);
        }
        review.fingerprint = hash.update(":" + review.total).digest("hex");
        if (preview) return NextResponse.json({ review });
        if (review.invalid || body.fingerprint !== review.fingerprint)
          return NextResponse.json({error:"ข้อมูลหรือการตั้งค่าไม่ตรงกับผลตรวจ กรุณาตรวจใหม่ก่อนยืนยัน", review}, {status:409});
        db.prepare("UPDATE _columns SET required=? WHERE table_name=? AND name=?").run(Number(required), table, column);
        return NextResponse.json({ok:true});
      })();
    }
    if (preview) return bad("แผนนี้ไม่มีการเปลี่ยนการบังคับกรอก", 400);
    if (design.conversion) return bad("กรุณาเปิดหน้าตรวจการแปลงและยืนยันจากผลตรวจก่อน", 409);
    const formulaEdits = (design.changes ?? []).filter(change => change.kind === "edit_formula" || change.kind === "edit_default" || change.kind === "edit_validation");
    for (const edit of formulaEdits) {
      const source = columnsOf(edit.table).find(column => column.name === edit.column);
      const calculated = edit.kind === "edit_formula";
      const current = source?.[aiFormulaField(edit.kind)];
      if (!source || !!source.is_virtual !== calculated || (edit.kind === "edit_default" && source.auto_number) ||
          (current ?? "") !== edit.previousFormula ||
          (edit.kind === "edit_validation" && edit.message !== undefined && (source.invalid_value_error ?? "") !== edit.previousMessage))
        return bad("สูตรเดิมหรือการตั้งค่าคอลัมน์เปลี่ยน กรุณาสร้างแผนใหม่", 409);
    }
    withApplication({ ...application, datasets: { ...application.datasets } }, () => db.transaction(() => {
      // Register every table before validating Ref columns, including forward references.
      for (const table of design.tables) createBuilderTable({ ...table, columns: [] }, null, true);
      const visible = new Set([...schema.visible,...design.tables.map(table => table.name)]);
      const additions = [
        ...design.tables.flatMap(table => table.columns.map(column => ({table:table.name,column}))),
        ...(design.changes ?? []).filter(change => change.kind === "add_column"),
      ];
      for (const calculated of [false,true]) {
        for (const {table,column} of additions) {
          if (!!column.formula === calculated) addDesignColumn(table, column, visible);
        }
      }
      for (const table of new Set(formulaEdits.map(edit => edit.table))) {
        const edits = new Map(formulaEdits.filter(edit => edit.table === table).map(edit => [edit.column,edit]));
        const columns = normalizeColumns(columnsOf(table).map(column => {
          const edit = edits.get(column.name);
          if (!edit) return column;
          return {...column,[aiFormulaField(edit.kind)]:edit.formula,
            ...(edit.kind === "edit_validation" && edit.message !== undefined ? {invalid_value_error:edit.message} : {})};
        }), {[table]:[]});
        const schemas = [...visible].map(name => ({name,columns:name === table ? columns : columnsOf(name)}));
        for (const column of columns.filter(column => edits.has(column.name))) {
          const edit = edits.get(column.name)!;
          const field = aiFormulaField(edit.kind);
          const check = formulaTypeCheck(column[field]!, column, field, columns, schemas);
          if (check.error) throw Error(check.error);
          db.prepare(`UPDATE _columns SET ${field}=? WHERE table_name=? AND name=?`).run(column[field], table, column.name);
          if (edit.kind === "edit_validation" && edit.message !== undefined)
            db.prepare("UPDATE _columns SET invalid_value_error=? WHERE table_name=? AND name=?").run(column.invalid_value_error, table, column.name);
        }
      }
      const updateLabel = db.prepare("UPDATE _columns SET label=? WHERE table_name=? AND name=?");
      for (const change of design.changes ?? []) {
        if (change.kind === "add_column" || change.kind === "edit_formula" || change.kind === "edit_default" || change.kind === "edit_validation") continue;
        else if (change.kind === "rename_label") updateLabel.run(change.label, change.table, change.column);
        else {
          const columns = columnsOf(change.table);
          const selected = columns.find(column => column.name === change.column)!;
          const updated = columns.map(column => (column.type === "image") === (selected.type === "image")
            ? { ...column, is_label: Number(column.name === selected.name) } : column);
          assertLabels(updated);
          const update = db.prepare("UPDATE _columns SET is_label=? WHERE table_name=? AND name=?");
          for (const column of updated) {
            if ((column.type === "image") === (selected.type === "image"))
              update.run(column.is_label, change.table, column.name);
          }
        }
      }
    })());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return bad(errorMessage(error));
  }
});
