import { withAuth } from "../../../../lib/auth-api";
import { currentDevelopment } from "../../../../lib/development-context";
import { columnsOf, db, tableExists } from "../../../../lib/db";
import { canRead, currentAccess, currentUser } from "../../../../lib/permissions";
import { FORMULA_FIELDS, SQLTYPE, type FormulaField } from "../../../../lib/columns";
import { aiDataDesign, aiDataDesignStatus, aiFormulaField, isAiFormulaEdit, isAiSchemaRequest } from "../../../../lib/ai-data-design";
import { dataDesignSchema } from "../../../../lib/ai-data-design-schema";
import { aiContextTerms, selectAiContext } from "../../../../lib/ai-context";
import { FUNCTION_NAMES } from "../../../../lib/expression";
import { AiQuotaError, aiConversation, aiFormulaMeasurement, aiSettingLinks, geminiProvider, openAiProvider, validateAiFormula, type AiSetting } from "../../../../lib/ai-assist";

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
  const viewDraft = body?.mode === "view_draft";
  const automationDraft = body?.mode === "automation_draft";
  const dataDesign = body?.mode === "data_design" ||
    (body?.mode === "ask" && typeof body.question === "string" && isAiSchemaRequest(body.question));
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
  const mentions = aiContextTerms(question, analyze ? body.source as string : "");
  const {tables, coverage} = selectAiContext(catalogue,
    name => name === table && formulaMode ? columns : columnsOf(name), mentions,
    column ? {table:table as string,column:column.name} : undefined);
  const settings: AiSetting[] = [];
  const settingId = (setting: AiSetting) => `setting_${settings.push(setting) - 1}`;
  const included = new Set(tables.map(item => item.name));
  const designSchema = dataDesign ? dataDesignSchema(included) : undefined;
  const automationActions = automationDraft
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
    availableColumnTypes: dataDesign ? Object.keys(SQLTYPE).filter(type => type !== "enumlist") : undefined,
    editableDesignTables: designSchema && development ? [...designSchema.editable.keys()].filter(name => included.has(name)) : undefined,
    conversation: !analyze ? aiConversation(body.history) : undefined,
    tables: tables.map(item => ({
      name: item.name, label: item.label.slice(0, 100),
      columns: item.selectedColumns.map(c => ({
        name: c.name, label: c.label.slice(0, 100), type: c.type,
        settingId: c.name === "id" ? undefined : settingId({ kind: "column", table: item.name, name: c.name, label: c.label.slice(0, 100) }),
        ref: c.ref_table && allowed.has(c.ref_table) ? c.ref_table : undefined,
        key: Boolean(c.is_key), calculated: Boolean(c.is_virtual), required: dataDesign ? Boolean(c.required) : undefined,
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
    if (designSchema) {
      const visible = new Set([...included].filter(name => designSchema.visible.has(name)));
      const editable = new Map([...designSchema.editable].filter(([name]) => included.has(name)));
      let design = aiDataDesign(suggestion.dataDesign, designSchema.existing, visible, development ? editable : undefined);
      if (design?.conversion) {
        const target = design.conversion;
        const source = tables.find(item => item.name === target.table)?.columns.find(item => item.name === target.column);
        if (!source || source.is_virtual || (source.type === target.type && (source.ref_table || null) === target.ref)) design = null;
      }
      if (design?.requirement) {
        const target = design.requirement;
        const source = tables.find(item => item.name === target.table)?.columns.find(item => item.name === target.column);
        if (!source || source.is_virtual || source.is_key || !!source.required === target.required) design = null;
      }
      for (const change of design?.changes ?? []) {
        if (!isAiFormulaEdit(change)) continue;
        const source = tables.find(item => item.name === change.table)?.columns.find(item => item.name === change.column);
        const calculated = change.kind === "edit_formula";
        const previousFormula = source?.[aiFormulaField(change.kind)];
        const changesMessage = change.kind === "edit_validation" && change.message !== undefined && change.message !== (source?.invalid_value_error ?? "");
        if (!source || !!source.is_virtual !== calculated || (change.kind === "edit_default" && source.auto_number) ||
            (change.kind === "edit_editable" && (source.is_editable === 0 || source.is_editable === false)) ||
            ((previousFormula ?? "") === change.formula && !changesMessage)) {
          design = null;
          break;
        }
        change.previousFormula = previousFormula ?? "";
        if (change.kind === "edit_validation" && change.message !== undefined) change.previousMessage = source.invalid_value_error ?? "";
      }
      const rejected = suggestion.dataDesign != null && !design;
      return reply({ answer: aiDataDesignStatus(!!design, !!development, rejected), formula: null, links, coverage,
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
    if (error instanceof AiQuotaError) return reply({ error: gemini
      ? "Gemini API ถึงขีดจำกัดคำขอหรือโควตา กรุณาลองใหม่ภายหลังหรือตรวจโควตาใน Google AI Studio"
      : "เครดิตหรือโควตา OpenAI API ไม่เพียงพอ กรุณาตรวจ Billing ของโปรเจกต์ที่ใช้กับ Builder" }, 503);
    return reply({ error: "ผู้ช่วย AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่" }, 502);
  } finally {
    inFlight--;
  }
});
