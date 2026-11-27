import { withAuth } from "../../../../lib/auth-api";
import { currentDevelopment } from "../../../../lib/development-context";
import { columnsOf, db, tableExists } from "../../../../lib/db";
import { canRead, currentAccess, currentUser } from "../../../../lib/permissions";
import { FORMULA_FIELDS, SQLTYPE, type FormulaField } from "../../../../lib/columns";
import { aiConversionChangesColumn, aiDataDesign, aiDataDesignStatus, aiFormulaField, aiConversionStageConflict, updateAiEnumOptions, isAiFormulaEdit, isAiSchemaRequest, splitAiConversionPlan } from "../../../../lib/ai-data-design";
import { dataDesignSchema } from "../../../../lib/ai-data-design-schema";
import { aiContextTerms, aiRelationships, ambiguousAiNames, resolveAiName, selectAiContext } from "../../../../lib/ai-context";
import { FUNCTION_NAMES } from "../../../../lib/expression";
import { AiResponseError, AiQuotaError, aiConversation, aiFormulaMeasurement, aiSettingLinks, geminiProvider, openAiProvider, validateAiFormula, type AiSetting } from "../../../../lib/ai-assist";

export const runtime = "nodejs";

const usage = new Map<number, number>();
let windowStarted = Date.now();
let inFlight = 0;

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const POST = withAuth(async (req: Request) => {
  const user = currentUser();
  if (!user || !currentAccess().builder) return reply({ error: "เฉพาะผู้พัฒนาแอปที่ใช้ผู้ช่วย AI ได้" }, 403);
  const provider = process.env.NOCODE_AI_PROVIDER || "openai";
  const gemini = provider === "gemini";
  const key = gemini ? process.env.NOCODE_AI_GEMINI_API_KEY : process.env.NOCODE_AI_OPENAI_API_KEY;
  const model = gemini ? process.env.NOCODE_AI_GEMINI_MODEL || "gemini-3.1-flash-lite" : process.env.NOCODE_AI_MODEL;
  if ((provider !== "openai" && !gemini) || !key?.trim() || !model?.trim()) {
    return reply({ error: gemini ? "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า API key ของ Gemini" : "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าผู้ช่วย AI" }, 503);
  }

  const reader = req.body?.getReader();
  if (!reader) return reply({ error: "กรุณาระบุคำถาม" }, 400);
  let raw = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  let body: Record<string, unknown>;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 65536) {
        void reader.cancel().catch(() => {});
        return reply({ error: "คำถามยาวเกินกำหนด" }, 413);
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    body = JSON.parse(raw + decoder.decode());
  } catch {
    return reply({ error: "รูปแบบคำถามไม่ถูกต้อง" }, 400);
  } finally {
    reader.releaseLock();
  }
  const explain = body?.mode === "explain_performance";
  const automationDraft = body?.mode === "automation_draft";
  const viewDraft = body?.mode === "view_draft";
  const explicitDesign = body?.mode === "data_design";
  const dataDesign = !automationDraft && (explicitDesign || body?.mode === "ask");
  const development = viewDraft || automationDraft || dataDesign ? currentDevelopment() : undefined;
  if ((viewDraft || automationDraft) && !development) return reply({ error: "เปิดพื้นที่พัฒนาโครงสร้างก่อนใช้ AI สร้างร่าง" }, 409);
  const analyze = explain || body?.mode === "analyze";
  if (analyze && (typeof body.source !== "string" || !body.source.trim() || body.source.length > 4000)) {
    return reply({ error: "กรุณาระบุสูตรเดิมไม่เกิน 4,000 ตัวอักษร" }, 400);
  }
  const question = explain
    ? "อธิบายผลวัดประสิทธิภาพของสูตรจากตัวเลขใน measurement ระบุว่าตารางไหนโหลดแถวมากและแนะนำจุดปรับก่อน แยกสิ่งที่วัดได้จากข้อสันนิษฐาน ค่ามาจากการทดสอบครั้งเดียว อย่าสรุปว่าแถวซ้ำทั้งหมดหรือใช้เวลาทั้งหมดในตารางหนึ่งหากไม่มีข้อมูลรองรับ ถ้าคำนวณล้มเหลวสถิติอาจไม่ครบ ให้เสนอสูตรทางเลือกเฉพาะเมื่อคงผลลัพธ์ได้"
    : analyze
    ? "อธิบายว่าสูตรเดิมทำอะไร ชี้งานซ้ำ การค้นหาข้ามตาราง และจุดที่อาจช้า หากเสนอสูตรใหม่ให้รักษาผลลัพธ์และอธิบายกรณีขอบเขตที่ควรทดสอบ ระบุว่าข้อสังเกตด้านความเร็วเป็นการประเมินจากสูตร หากยังเสนอสูตรที่เทียบเท่าไม่ได้ให้คืน formula เป็น null"
    : body?.question;
  if (typeof question !== "string" || !question.trim() || question.length > 1500) {
    return reply({ error: "กรุณากรอกคำถามไม่เกิน 1,500 ตัวอักษร" }, 400);
  }

  const table = body.table;
  const field = body.field as FormulaField;
  const formulaMode = analyze || body.mode === "formula";
  if (formulaMode && (typeof table !== "string" || !tableExists(table) || !canRead(table) ||
      typeof body.column !== "string" || !FORMULA_FIELDS.includes(field))) {
    return reply({ error: "ไม่พบคอลัมน์สูตรในแอปนี้ หรือไม่มีสิทธิ์เข้าถึง" }, 400);
  }
  const existingTables = db.prepare("SELECT name,label FROM _tables ORDER BY name").all() as { name: string; label: string }[];
  const catalogue = existingTables.filter(item => tableExists(item.name) && canRead(item.name));
  const allowed = new Set(catalogue.map(item => item.name));
  const measurement = explain ? aiFormulaMeasurement(body.measurement, allowed) : undefined;
  if (explain && !measurement) return reply({ error: "กรุณาทดสอบและวัดประสิทธิภาพก่อน" }, 400);
  const columns = formulaMode ? columnsOf(table as string) : [];
  const column = columns.find(item => item.name === body.column);
  if (formulaMode && !column) return reply({ error: "กรุณาบันทึกคอลัมน์ก่อนใช้ AI ช่วยเขียนสูตร" }, 400);
  if (Date.now() - windowStarted >= 60_000) {
    usage.clear();
    windowStarted = Date.now();
  }
  const used = usage.get(user.id) ?? 0;
  if (used >= 8 || usage.size >= 150 && !usage.has(user.id) || inFlight >= 4) {
    return reply({ error: "ผู้ช่วย AI รับคำขอถึงขีดจำกัดแล้ว กรุณาลองใหม่ในอีกสักครู่" }, 429);
  }
  const conversation = !analyze ? aiConversation(body.history) : undefined;
  const mentions = aiContextTerms(question, analyze ? body.source as string : "",
    conversation?.map(turn => turn.question + "\n" + turn.answer).join("\n"));
  const {tables, coverage} = selectAiContext(catalogue,
    name => name === table && formulaMode ? columns : columnsOf(name), mentions,
    column ? {table:table as string,column:column.name} : undefined);
  const settings: AiSetting[] = [];
  const settingId = (setting: AiSetting) => `setting_${settings.push(setting) - 1}`;
  const included = new Set(tables.map(item => item.name));
  const designSchema = dataDesign ? dataDesignSchema(included) : undefined;
  const automationActions = automationDraft || dataDesign
    ? (db.prepare("SELECT table_name AS 'table',name,label FROM _actions WHERE kind='set' ORDER BY name").all() as {table: string; name: string; label: string}[])
      .filter(action => included.has(action.table)).slice(0, 30).map(action => ({...action,label:action.label.slice(0,100)}))
    : undefined;
  const relatedSettings = (kind: "slice" | "action") => {
    const sql = kind === "slice" ? "SELECT table_name,name,label FROM _slices ORDER BY name"
      : "SELECT table_name,name,label FROM _actions ORDER BY name";
    return (db.prepare(sql).all() as {table_name: string; name: string; label: string}[])
      .filter(item => included.has(item.table_name))
      .sort((a,b) => Number(question.includes(b.name) || question.includes(b.label)) - Number(question.includes(a.name) || question.includes(a.label)))
      .slice(0, 20).map(item => {
        const setting = { kind, table: item.table_name, name: item.name, label: item.label.slice(0, 100) };
        return { ...setting, id: settingId(setting) };
      });
  };
  const context = {
    coverage,
    conversationFocus: typeof body.focus === "string" && ["auto","requirements","design","technical"].includes(body.focus)
      ? body.focus : "auto",
    relationships: aiRelationships(tables, allowed),
    tableCatalogue: dataDesign ? [...catalogue].sort((a,b)=>mentions(b)-mentions(a)).slice(0,100)
      .map(item=>({name:item.name,label:item.label.slice(0,100),schemaIncluded:included.has(item.name)})) : undefined,
    tableCatalogueTruncated: dataDesign ? catalogue.length > 100 : undefined,
    availableColumnTypes: dataDesign ? Object.keys(SQLTYPE) : undefined,
    availableConversionTypes: dataDesign ? Object.keys(SQLTYPE) : undefined,
    editableDesignTables: designSchema && development ? [...designSchema.editable.keys()].filter(name => included.has(name)) : undefined,
    conversation,
    interaction: explicitDesign ? "design" : "conversation",
    tables: tables.map(item => ({
      name: item.name, label: item.label.slice(0, 100),
      columns: item.selectedColumns.map(c => ({
        name: c.name, label: c.label.slice(0, 100), type: c.type,
        settingId: c.name === "id" ? undefined : settingId({ kind: "column", table: item.name, name: c.name, label: c.label.slice(0, 100) }),
        ref: c.ref_table && allowed.has(c.ref_table) ? c.ref_table : undefined,
        key: Boolean(c.is_key), calculated: Boolean(c.is_virtual), required: dataDesign ? Boolean(c.required) : undefined,
        ...(dataDesign && ["enum","enumlist"].includes(c.type) && c.options
          ? {enumOptions:c.options.slice(0,2000),enumOptionsTruncated:c.options.length > 2000} : {}),
        ...(dataDesign && mentions(c)
          ? {calculation:c.virtual_expr?.slice(0, 600), defaultFormula:c.default_expr?.slice(0,600),
            validIf:c.valid_if?.slice(0,600), showIf:c.show_if?.slice(0,600), editableIf:c.editable_if?.slice(0,600), requiredIf:c.required_if?.slice(0,600), canEdit:c.is_editable !== 0 && c.is_editable !== false, autoNumber:!!c.auto_number} : {}),
      })),
    })),
    settings: [...relatedSettings("slice"), ...relatedSettings("action")],
    automationActions,
    scope: "Only the supplied subset is visible. It may be incomplete.",
    target: column ? { table, column: column.name, type: column.type, field } : undefined,
    functions: formulaMode || dataDesign ? FUNCTION_NAMES : undefined,
    originalFormula: analyze ? body.source : undefined,
    measurement,
  };
  usage.set(user.id, used + 1);
  inFlight++;
  try {
    const createProvider = gemini ? geminiProvider : openAiProvider;
    const suggestion = await createProvider(key.trim(), model.trim())(
      { question: question.trim(), context, formula: formulaMode, viewDraft, automationDraft, dataDesign },
      AbortSignal.any([req.signal, AbortSignal.timeout(25_000)]),
    );
    const links = aiSettingLinks(suggestion.references, settings);
    if (dataDesign && suggestion.automationDraft && suggestion.dataDesign == null) {
      const draft = suggestion.automationDraft;
      const valid = automationActions?.some(action=>action.table===draft.table && action.name===draft.action);
      return reply({answer:valid ? suggestion.answer : "ไม่พบ Action ที่ตรงกับงานอัตโนมัติในบริบทนี้ กรุณาระบุหรือสร้าง Action ก่อน",
        formula:null,links,coverage,
        automationDraft:valid && development ? {...draft,workspace:development.id} : null});
    }
    if (designSchema && (explicitDesign || suggestion.dataDesign != null)) {
      const visible = new Set([...included].filter(name => designSchema.visible.has(name)));
      const editable = new Map([...designSchema.editable].filter(([name]) => included.has(name)));
      let proposal = suggestion.dataDesign as Partial<import("../../../../lib/ai-data-design").AiDataDesign> | null;
      if (proposal && Array.isArray(proposal.changes)) {
        proposal = {...proposal, changes:proposal.changes.map(change => {
          if (!change || typeof change !== "object") return change;
          const tableName = resolveAiName(change.table, catalogue);
          const source = tables.find(item => item.name === tableName);
          if (change.kind === "add_column") return {...change,table:tableName ?? change.table};
          const columnName = resolveAiName(change.column, source?.columns ?? []);
          return {...change,table:tableName ?? change.table,column:columnName ?? change.column};
        })};
      }
      if (proposal?.requirement) {
        const requirement = proposal.requirement;
        const tableName = resolveAiName(requirement.table, catalogue);
        const source = tables.find(item => item.name === tableName);
        const columnName = resolveAiName(requirement.column, source?.columns ?? []);
        proposal = {...proposal,requirement:{...requirement,table:tableName ?? requirement.table,column:columnName ?? requirement.column}};
      }
      let nextRequirement: import("../../../../lib/ai-data-design").AiDataDesign["requirement"];
      const requiredAdds = proposal?.changes?.filter(change=>change?.kind==="add_column" && change.column?.required);
      if (requiredAdds?.length === 1 && !proposal?.requirement && !proposal?.conversion) {
        const addition = requiredAdds[0];
        if (addition.kind === "add_column" && !addition.column.formula) {
          nextRequirement = {table:addition.table,column:addition.column.name,required:true};
          proposal = {...proposal,changes:proposal!.changes!.map(change=>change===addition
            ? {...addition,column:{...addition.column,required:false}} : change)};
        }
      }
      let conversion = proposal?.conversion;
      let enumAdditions: string[] | undefined;
      let enumRemovals: string[] | undefined;
      let optionProblem: string | undefined;
      let choices: {label: string; name: string; instruction: string}[] = [];
      if (conversion && development) {
        const tableName = resolveAiName(conversion.table, catalogue);
        const source = tables.find(item => item.name === tableName);
        const columnName = resolveAiName(conversion.column, source?.columns ?? []);
        const refName = conversion.type === "ref" ? resolveAiName(conversion.ref, catalogue) : undefined;
        const ambiguous = [
          {field:"ตารางต้นทาง", matches:ambiguousAiNames(conversion.table, catalogue), permitted:(name:string)=>designSchema.editable.has(name)},
          {field:"คอลัมน์ต้นทาง", matches:ambiguousAiNames(conversion.column, source?.columns ?? []), permitted:(name:string)=>!!tableName && !!editable.get(tableName)?.has(name)},
          {field:"ตารางปลายทาง Ref", matches:conversion.type === "ref" ? ambiguousAiNames(conversion.ref, catalogue) : [], permitted:(name:string)=>canRead(name)},
        ].find(item => item.matches.length > 1);
        choices = ambiguous?.matches.filter(item => ambiguous.permitted(item.name)).slice(0,8)
          .map(({name,label}) => ({name,label,instruction:`ใช้ ${ambiguous.field} ชื่อในระบบ ${name}`})) ?? [];
        conversion = {...conversion, table:tableName ?? conversion.table, column:columnName ?? conversion.column, ref:refName ?? conversion.ref};
        const hasAdditions = Object.hasOwn(conversion, "addOptions");
        const hasRemovals = Object.hasOwn(conversion, "removeOptions");
        if (hasAdditions || hasRemovals) {
          const current = source?.columns.find(item => item.name === columnName);
          const delta = conversion as {addOptions?:unknown;removeOptions?:unknown};
          const merged = current?.type === conversion.type && conversion.ref == null && conversion.options == null
            ? updateAiEnumOptions(current, delta.addOptions, delta.removeOptions) : null;
          if (merged === null) optionProblem = "เปลี่ยนตัวเลือกไม่ได้ กรุณาระบุรายการเพิ่มและรายการลบให้ต่างกัน และให้เหลืออย่างน้อยหนึ่งตัวเลือกในคอลัมน์ Enum หรือ EnumList";
          else {
            enumRemovals = delta.removeOptions as string[] | undefined;
            enumAdditions = delta.addOptions as string[] | undefined;
            conversion = {table:conversion.table,column:conversion.column,type:conversion.type,ref:null,options:merged};
          }
        }
      }
      const normalized = conversion ? {...proposal, conversion} : proposal;
      const split = development && !choices.length && !optionProblem ? splitAiConversionPlan(normalized, designSchema.existing, visible, editable) : null;
      const splitSource = split && tables.find(table => table.name === split.next.table)?.columns.find(column => column.name === split.next.column);
      const staged = split && splitSource && !splitSource.is_virtual &&
        !(splitSource.type === split.next.type && splitSource.ref_table && split.next.options !== undefined) &&
        aiConversionChangesColumn(splitSource, split.next) ? split : null;
      let design = optionProblem ? null : staged?.first ?? aiDataDesign(normalized, designSchema.existing, visible, development ? editable : undefined);
      let reason: string | undefined;
      if (!design && conversion && catalogue.some(item=>item.name===conversion.table) && !included.has(conversion.table)) {
        reason = "พบตารางต้นทาง แต่ยังไม่ได้โหลดรายละเอียด กรุณาส่งคำสั่งโดยระบุชื่อตารางนี้เพื่อโหลดโครงสร้าง";
        choices = [{name:conversion.table,label:catalogue.find(item=>item.name===conversion.table)!.label,
          instruction:`ใช้ตารางต้นทางชื่อในระบบ ${conversion.table}`}];
      }
      if (!design && conversion) {
        if (!development) reason = "เปิดพื้นที่พัฒนาโครงสร้างของแอปก่อนตรวจการแปลงชนิดข้อมูล";
        else if (!editable.get(conversion.table)?.has(conversion.column)) reason = "ไม่พบตารางหรือคอลัมน์ต้นทางที่แก้ไขได้ในบริบทนี้ กรุณาระบุชื่อในระบบ";
        else if (aiConversionStageConflict(normalized)) reason = `แผนขั้นแรกแก้ ${conversion.table}.${conversion.column} ซึ่งเป็นคอลัมน์ที่จะแปลง กรุณาแยกการตั้งค่าคอลัมน์หรือ Action ที่เขียนค่านี้ไปทำหลังแปลงเสร็จ`;
        else if (conversion.type === "ref" && (!conversion.ref || !visible.has(conversion.ref))) reason = "ไม่พบตารางปลายทาง Ref ในบริบทที่ Copilot อ่านได้ กรุณาตรวจชื่อในระบบหรือการเชื่อมตารางกับแอป";
        else if (conversion.type === "user" && conversion.ref != null) reason = "ชนิด User ใช้ผู้ใช้ของแอปโดยตรง แผนนี้ใส่ตาราง Ref มาด้วย กรุณาสั่งเปลี่ยนคอลัมน์เป็น User โดยใช้ผู้ใช้ในแอป";
        else if (conversion.type === "user" && conversion.options?.trim()) reason = "ชนิด User ใช้ผู้ใช้ของแอป แผนนี้ใส่ตัวเลือกข้อความมาด้วย กรุณาส่งคำสั่งเปลี่ยนเป็น User อีกครั้ง";
        else reason = "แผนแปลงชนิดมีรูปแบบที่ Builder ใช้ไม่ได้ กรุณาระบุคอลัมน์เดิม ชนิดใหม่ และตัวเลือกที่ต้องการ";
      }
      if (design?.conversion) {
        const target = design.conversion;
        const source = tables.find(item => item.name === target.table)?.columns.find(item => item.name === target.column);
        if (!source || source.is_virtual) {
          reason = "การตรวจแปลงชนิดรองรับคอลัมน์จริง กรุณาตรวจคอลัมน์ต้นทาง";
          design = null;
        } else if (source.type === target.type && source.ref_table && target.options !== undefined) {
          reason = "คอลัมน์นี้ดึงตัวเลือกจากตารางอ้างอิง กรุณาแก้รายการในตารางปลายทาง";
          design = null;
        } else if (!aiConversionChangesColumn(source, target)) {
          reason = "คอลัมน์นี้ใช้การตั้งค่าตามที่ขออยู่แล้ว";
          design = null;
        }
      }
      if (design?.requirement) {
        const target = design.requirement;
        const source = tables.find(item => item.name === target.table)?.columns.find(item => item.name === target.column);
        if (!source || source.is_virtual || source.is_key) {
          reason = `ตรวจการบังคับกรอก ${target.table}.${target.column} ไม่ได้ กรุณาเลือกคอลัมน์จริงที่ใช้กรอกข้อมูลและไม่ได้เป็น Key`;
          design = null;
        } else if (!!source.required === target.required) {
          reason = `คอลัมน์ ${target.table}.${target.column} ${target.required ? "เปิด" : "ปิด"}การบังคับกรอกอยู่แล้ว`;
          design = null;
        }
      }
      for (const change of design?.changes ?? []) {
        if (!isAiFormulaEdit(change)) continue;
        const source = tables.find(item => item.name === change.table)?.columns.find(item => item.name === change.column);
        const calculated = change.kind === "edit_formula";
        const previousFormula = source?.[aiFormulaField(change.kind)];
        const changesMessage = change.kind === "edit_validation" && change.message !== undefined && change.message !== (source?.invalid_value_error ?? "");
        const name = change.table + "." + change.column;
        if (!source) reason = `ไม่พบคอลัมน์ ${name} ในบริบทปัจจุบัน กรุณาตรวจชื่อหรือเลือกตารางอีกครั้ง`;
        else if (!!source.is_virtual !== calculated) reason = calculated
          ? `คอลัมน์ ${name} เป็นคอลัมน์จริง กรุณาเลือกคอลัมน์คำนวณสำหรับแก้สูตรคำนวณ`
          : `คอลัมน์ ${name} เป็นคอลัมน์คำนวณ กรุณาแก้สูตรคำนวณของคอลัมน์นี้`;
        else if (change.kind === "edit_default" && source.auto_number)
          reason = `คอลัมน์ ${name} ใช้เลขรันอัตโนมัติ กรุณาตรวจการตั้งค่าเลขรันก่อนเปลี่ยนค่าเริ่มต้น`;
        else if (change.kind === "edit_editable" && (source.is_editable === 0 || source.is_editable === false))
          reason = `คอลัมน์ ${name} ปิดการแก้ไขอยู่ กรุณาเปิดการแก้ไขคอลัมน์ก่อนกำหนดเงื่อนไข`;
        else if ((previousFormula ?? "") === change.formula && !changesMessage)
          reason = `คอลัมน์ ${name} ใช้สูตรและข้อความตามแผนนี้อยู่แล้ว`;
        if (reason) {
          design = null;
          break;
        }
        change.previousFormula = previousFormula ?? "";
        if (change.kind === "edit_validation" && change.message !== undefined) change.previousMessage = source.invalid_value_error ?? "";
      }
      const rejected = suggestion.dataDesign != null && !design;
      return reply({ answer: choices.length ? (choices.length === 1 ? "พบตารางแล้ว เลือกเพื่อใส่ชื่อในคำสั่งและโหลดรายละเอียดล่าสุด" : "พบหลายรายการที่ใช้ชื่อเดียวกัน กรุณาเลือกรายการที่ต้องการแล้วส่งคำสั่งอีกครั้ง") : optionProblem ?? reason ?? aiDataDesignStatus(!!design, !!development, rejected), formula: null, links, coverage,
        choices, nextConversion: design ? staged?.next : undefined, enumAdditions: design ? enumAdditions : undefined,
        enumRemovals: design ? enumRemovals : undefined,
        nextRequirement: design ? nextRequirement : undefined,
        dataDesign: design, designWorkspace: development?.id, designAttempt: true });
    }
    if (automationDraft && development) {
      const proposal = suggestion.automationDraft;
      const valid = proposal && automationActions?.some(action => action.table === proposal.table && action.name === proposal.action);
      return reply({ answer: suggestion.answer, formula: null, links, coverage,
        automationDraft: valid ? { ...proposal, workspace: development.id } : null });
    }
    if (viewDraft && development) {
      const proposal = suggestion.viewDraft;
      return reply({ answer: suggestion.answer, formula: null, links, coverage,
        viewDraft: proposal && included.has(proposal.table) ? { ...proposal, workspace: development.id } : null });
    }
    if (!column || !suggestion.formula || analyze && suggestion.formula === (body.source as string).trim()) {
      return reply({ answer: suggestion.answer, formula: null, links, coverage });
    }
    const validationError = validateAiFormula(suggestion.formula, column, field, table as string, columns, tables);
    return reply({ answer: suggestion.answer, formula: suggestion.formula, validationError, links, coverage });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return reply({error:"AI ใช้เวลาตอบเกิน 25 วินาที กรุณาลองใหม่ หรือแบ่งคำถามเป็นขั้นตอนสั้นลง"},504);
    if (error instanceof AiResponseError) {
      const messages = {
        timeout:"การเชื่อมต่อ AI หมดเวลา กรุณาลองใหม่",
        incomplete:"คำตอบ AI ถูกตัดก่อนจบ กรุณาแบ่งงานเป็นขั้นตอนย่อยแล้วลองใหม่",
        format:"AI ส่งคำตอบในรูปแบบที่ Builder อ่านไม่ได้ กรุณาลองส่งอีกครั้ง",
        provider:"ผู้ให้บริการ AI ปฏิเสธคำขอหรือขัดข้องชั่วคราว กรุณาตรวจการตั้งค่าโมเดลและลองใหม่",
      };
      return reply({error:messages[error.reason]},502);
    }
    if (error instanceof AiQuotaError) return reply({ error: gemini
      ? "Gemini API ถึงขีดจำกัดคำขอหรือโควตา กรุณาลองใหม่ภายหลังหรือตรวจโควตาใน Google AI Studio"
      : "เครดิตหรือโควตา OpenAI API ไม่เพียงพอ กรุณาตรวจ Billing ของโปรเจกต์ที่ใช้กับ Builder" }, 503);
    return reply({ error: "ผู้ช่วย AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่" }, 502);
  } finally {
    inFlight--;
  }
});
