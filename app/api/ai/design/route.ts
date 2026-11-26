import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-api";
import { bad, errorMessage, readBody } from "@/lib/api";
import { currentDevelopment } from "@/lib/development-context";
import { currentApplication, withApplication } from "@/lib/application-context";
import { aiDataDesign, aiFormulaField, isAiFormulaEdit, type AiDataDesign, type AiRequirementReview } from "@/lib/ai-data-design";
import { dataDesignSchema } from "@/lib/ai-data-design-schema";
import { addBuilderColumn, createBuilderTable } from "@/lib/table-builder";
import { columnsOf, db } from "@/lib/db";
import { assertLabels, normalizeValue } from "@/lib/columns";
import { isBlank } from "@/lib/expression";
import { createHash, randomUUID } from "node:crypto";
import { formulaTypeCheck } from "@/lib/formula-result-type";
import { normalizeColumns } from "@/lib/metadata";
import { currentUser } from "@/lib/permissions";
import { authorizeAiPlan, cancelAiPlan, completeAiPlan, isAiPlanAuthorized, listAiPlans, ownsAppliedAiPlan, registerAiPlan, resumeAiPlan } from "@/lib/ai-plan-ledger";
import { aiUndoState, captureAiUndo, saveAiUndo, undoAiPlan } from "@/lib/ai-plan-undo";
import { writeView } from "@/lib/view-api";
import { saveAction } from "@/lib/action-api";

const rollbackPreview = Symbol("ai-design-preview");

function currentPlanScope() {
  const development = currentDevelopment(), application = currentApplication(), actor = currentUser();
  return development && application && actor
    ? {appId:application.id,workspaceId:development.id,actorId:actor.id} : undefined;
}

export const GET = withAuth(async (request:Request) => {
  const scope = currentPlanScope();
  if (!scope) return bad("เปิดพื้นที่พัฒนาโครงสร้างก่อนดูประวัติแผน",409);
  const planId = new URL(request.url).searchParams.get("planId");
  if (planId) {
    const pending = resumeAiPlan(scope,planId);
    if (!pending) return bad("ไม่พบแผนที่อนุมัติและยังเปิดต่อได้ในพื้นที่นี้",409);
    const schema = dataDesignSchema();
    const design = aiDataDesign(pending.design,schema.existing,schema.visible,schema.editable);
    if (!design) return bad("โครงสร้างหรือสิทธิ์เปลี่ยน กรุณาตรวจแผนใหม่",409);
    return NextResponse.json({...pending,design,workspace:scope.workspaceId});
  }
  return NextResponse.json({plans:(listAiPlans(scope) as {planId:string}[]).map(plan => ({...plan,...aiUndoState(plan.planId)}))});
});

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
  const scope = currentPlanScope();
  if (!development || !application || !scope) return bad("เปิดพื้นที่พัฒนาโครงสร้างก่อนนำแบบร่างไปใช้", 409);
  let fingerprint: string | undefined;
  let reviewedDesign: AiDataDesign | undefined;
  try {
    const body = await readBody(request);
    if (body.workspace !== development.id) return bad("พื้นที่พัฒนาเปลี่ยน กรุณาสร้างแบบร่างใหม่ในพื้นที่ปัจจุบัน", 409);
    if (body.op === "cancel") {
      const cancelledAt = body.confirm === true ? cancelAiPlan(scope,body.planId) : null;
      return cancelledAt ? NextResponse.json({ok:true,cancelledAt}) : bad("ไม่พบแผนที่ยกเลิกได้ในพื้นที่นี้",409);
    }
    if (body.op === "approve") {
      if (!authorizeAiPlan(scope,body.planId,body.fingerprint))
        return bad("ผลตรวจแผนหมดอายุหรือไม่ตรงกับผู้อนุมัติ กรุณาตรวจใหม่",409);
      return NextResponse.json({ok:true});
    }
    if (body.op === "undo") {
      if (body.confirm !== true || !ownsAppliedAiPlan(scope,body.planId)) return bad("ไม่พบแผนที่ยืนยันย้อนกลับได้",409);
      return NextResponse.json({ok:true,...undoAiPlan(body.planId,dataDesignSchema().editable)});
    }
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    const actor = currentUser();
    const reviewedRequest = body.reviewed === true || body.planId !== undefined;
    const receiptKey = !preview && reviewedRequest && typeof body.fingerprint === "string" && /^[a-f0-9]{64}$/.test(body.fingerprint)
      ? createHash("sha256").update(JSON.stringify([development.id, application.id, actor?.id, body.planId, body.fingerprint, body.design])).digest("hex")
      : undefined;
    if (receiptKey && db.prepare("SELECT 1 FROM sqlite_schema WHERE name='_ai_design_receipts' AND type='table'").get()) {
      const receipt = db.prepare("SELECT id FROM _ai_design_receipts WHERE request_key=?").get(receiptKey) as {id:string} | undefined;
      if (receipt) {
        if (typeof body.planId === "string" && aiUndoState(body.planId).revertedAt)
          return bad("แผนนี้ย้อนกลับแล้ว กรุณาสร้างแผนใหม่หากต้องการใช้ซ้ำ",409);
        return NextResponse.json({ok:true,receiptId:receipt.id,replayed:true});
      }
    }
    if (!preview && reviewedRequest && !isAiPlanAuthorized(scope,body.planId,body.fingerprint))
      return bad("กรุณาอนุมัติแผนที่ผ่านการตรวจและยังไม่หมดอายุก่อนนำไปใช้",409);
    const recordReceipt = () => {
      if (!receiptKey) return undefined;
      db.exec("CREATE TABLE IF NOT EXISTS _ai_design_receipts (request_key TEXT PRIMARY KEY,id TEXT NOT NULL,created_at INTEGER NOT NULL)");
      const id = randomUUID();
      db.prepare("INSERT INTO _ai_design_receipts VALUES(?,?,?)").run(receiptKey,id,Date.now());
      completeAiPlan(scope,body.planId,id);
      return id;
    };
    const schema = dataDesignSchema();
    const design = aiDataDesign(body.design, schema.existing, schema.visible, schema.editable);
    if (!design) return bad("แผนไม่ตรงกับโครงสร้างปัจจุบัน กรุณาตรวจสิทธิ์และสร้างแบบร่างใหม่", 409);
    reviewedDesign = design;
    if (design.requirement) {
      const { table, column, required } = design.requirement;
      return db.transaction(() => {
        const source = columnsOf(table).find(item => item.name === column);
        if (!source || source.is_virtual || source.is_key || !!source.required === required)
          return bad("คอลัมน์นี้เปลี่ยนการบังคับกรอกตามแผนไม่ได้ กรุณาตรวจโครงสร้างปัจจุบัน", 409);
        const hash = createHash("sha256").update(JSON.stringify([development.id, application.id, actor?.id, table, source, required]));
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
        if (preview) return NextResponse.json({review:review.invalid ? review : {...review,...registerAiPlan(scope,review.fingerprint,design,review)}});
        if (review.invalid || body.fingerprint !== review.fingerprint)
          return NextResponse.json({error:"ข้อมูลหรือการตั้งค่าไม่ตรงกับผลตรวจ กรุณาตรวจใหม่ก่อนยืนยัน", review}, {status:409});
        db.prepare("UPDATE _columns SET required=? WHERE table_name=? AND name=?").run(Number(required), table, column);
        return NextResponse.json({ok:true,receiptId:recordReceipt()});
      })();
    }
    if (design.conversion) return bad("กรุณาเปิดหน้าตรวจการแปลงและยืนยันจากผลตรวจก่อน", 409);
    const reviewRequested = preview || reviewedRequest || body.fingerprint !== undefined;
    if (reviewRequested) {
      const metadata = [...schema.visible].sort().map(name => [name,columnsOf(name)]);
      const views = design.views?.length ? db.prepare("SELECT * FROM _views ORDER BY name").all() : [];
      const actions = design.actions?.length ? db.prepare("SELECT * FROM _actions ORDER BY name").all() : [];
      const fingerprintInput = [development.id,application.id,currentUser()?.id, [...schema.editable.keys()].sort(),metadata,views,actions,design];
      fingerprint = createHash("sha256").update(JSON.stringify(fingerprintInput)).digest("hex");
      if (!preview && body.fingerprint !== fingerprint)
        return bad("โครงสร้างหรือแผนเปลี่ยนหลังตรวจ กรุณาตรวจใหม่ก่อนยืนยัน", 409);
    }
    const formulaEdits = (design.changes ?? []).filter(isAiFormulaEdit);
    for (const edit of formulaEdits) {
      const source = columnsOf(edit.table).find(column => column.name === edit.column);
      const calculated = edit.kind === "edit_formula";
      const current = source?.[aiFormulaField(edit.kind)];
      if (!source || !!source.is_virtual !== calculated || (edit.kind === "edit_default" && source.auto_number) ||
          (current ?? "") !== edit.previousFormula ||
          (edit.kind === "edit_editable" && (source.is_editable === 0 || source.is_editable === false)) ||
          (edit.kind === "edit_validation" && edit.message !== undefined && (source.invalid_value_error ?? "") !== edit.previousMessage))
        return bad("สูตรเดิมหรือการตั้งค่าคอลัมน์เปลี่ยน กรุณาสร้างแผนใหม่", 409);
    }
    const receiptId = withApplication({ ...application, datasets: { ...application.datasets } }, () => db.transaction(() => {
      const undo = receiptKey ? captureAiUndo(design) : [];
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
        const edits = formulaEdits.filter(edit => edit.table === table);
        const columns = normalizeColumns(columnsOf(table).map(column => {
          const revised = {...column};
          for (const edit of edits.filter(item => item.column === column.name)) {
            revised[aiFormulaField(edit.kind)] = edit.formula;
            if (edit.kind === "edit_validation" && edit.message !== undefined) revised.invalid_value_error = edit.message;
          }
          return revised;
        }), {[table]:[]});
        const schemas = [...visible].map(name => ({name,columns:name === table ? columns : columnsOf(name)}));
        for (const edit of edits) {
          const column = columns.find(item => item.name === edit.column)!;
          const field = aiFormulaField(edit.kind);
          const check = formulaTypeCheck(column[field] ?? "", column, field, columns, schemas);
          if (check.error) throw Error(check.error);
          db.prepare(`UPDATE _columns SET ${field}=? WHERE table_name=? AND name=?`).run(column[field], table, column.name);
          if (edit.kind === "edit_validation" && edit.message !== undefined)
            db.prepare("UPDATE _columns SET invalid_value_error=? WHERE table_name=? AND name=?").run(column.invalid_value_error, table, column.name);
        }
      }
      const updateLabel = db.prepare("UPDATE _columns SET label=? WHERE table_name=? AND name=?");
      for (const change of design.changes ?? []) {
        if (change.kind === "add_column" || isAiFormulaEdit(change)) continue;
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
      for (const {table,column} of additions) {
        const saved = columnsOf(table).find(item => item.name === column.name);
        if (!saved || saved.type !== column.type || (saved.ref_table || null) !== column.ref ||
            (saved.virtual_expr || "") !== (column.formula || ""))
          throw Error("ผลตรวจหลังบันทึกไม่ตรงกับแผน");
      }
      for (const edit of formulaEdits) {
        const saved = columnsOf(edit.table).find(item => item.name === edit.column);
        if (!saved || (saved[aiFormulaField(edit.kind)] ?? "") !== edit.formula)
          throw Error("ผลตรวจสูตรหลังบันทึกไม่ตรงกับแผน");
      }
      for (const view of design.views ?? []) {
        const name = "view_" + randomUUID().replaceAll("-","");
        const {pos} = db.prepare("SELECT COALESCE(MAX(pos),0)+1 AS pos FROM _views WHERE position='menu'").get() as {pos:number};
        writeView({name,label:view.label,table_name:view.table,kind:view.kind,position:"menu",pos,columns:[],sort_column:"id",sort_dir:"desc"});
        if (!db.prepare("SELECT 1 FROM _views WHERE name=? AND label=? AND table_name=? AND kind=? AND position='menu'")
          .get(name,view.label,view.table,view.kind)) throw Error("ผลตรวจ View หลังบันทึกไม่ตรงกับแผน");
      }
      for (const action of design.actions ?? []) {
        const columns = columnsOf(action.table);
        const tables = [...visible].map(name => ({name,columns:name === action.table ? columns : columnsOf(name)}));
        for (const {column,formula} of action.updates) {
          const field = columns.find(item => item.name === column);
          if (!field || field.is_virtual || field.is_editable === false || field.is_editable === 0)
            throw Error("Action ต้องเลือกคอลัมน์ข้อมูลจริงที่แก้ไขได้");
          const check = formulaTypeCheck(formula,field,"default_expr",columns,tables);
          if (check.error) throw Error(check.error);
        }
        const condition = formulaTypeCheck(action.condition,columns[0],"show_if",columns,tables);
        if (condition.error) throw Error(condition.error);
        const values = Object.fromEntries(action.updates.map(update => [update.column,update.formula]));
        saveAction({name:action.name,label:action.label,table_name:action.table,kind:"set",condition_expr:action.condition,
          values,confirmation:"",config:{value_mode:"snapshot"},appearance:{position:"prominent"}},false);
        const stored = db.prepare("SELECT table_name,kind,condition_expr,values_json FROM _actions WHERE name=?").get(action.name) as
          {table_name:string;kind:string;condition_expr:string;values_json:string}|undefined;
        if (!stored || stored.table_name !== action.table || stored.kind !== "set" || stored.condition_expr !== action.condition ||
            stored.values_json !== JSON.stringify(values)) throw Error("ผลตรวจ Action หลังบันทึกไม่ตรงกับแผน");
      }
      if (preview) throw rollbackPreview;
      if (receiptKey) saveAiUndo(body.planId,undo);
      return recordReceipt();
    })());
    return NextResponse.json({ ok: true, receiptId });
  } catch (error) {
    if (error === rollbackPreview && fingerprint && reviewedDesign) {
      try { return NextResponse.json({ok:true, review:{fingerprint,...registerAiPlan(scope,fingerprint,reviewedDesign)}}); }
      catch (ledgerError) { return bad(errorMessage(ledgerError)); }
    }
    return bad(errorMessage(error));
  }
});
