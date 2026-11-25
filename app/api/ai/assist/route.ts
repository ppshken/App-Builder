import { withAuth } from "../../../../lib/auth-api";
import { currentDevelopment } from "../../../../lib/development-context";
import { columnsOf, db, tableExists } from "../../../../lib/db";
import { canRead, currentAccess, currentUser } from "../../../../lib/permissions";
import { FORMULA_FIELDS, type FormulaField } from "../../../../lib/columns";
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
  const development = viewDraft ? currentDevelopment() : undefined;
  if (viewDraft && !development) return reply({ error: "เปิดพื้นที่พัฒนาโครงสร้างก่อนให้ AI ร่าง View" }, 409);
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
  const catalogue = (db.prepare("SELECT name,label FROM _tables ORDER BY name").all() as { name: string; label: string }[])
    .filter(item => tableExists(item.name) && canRead(item.name));
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
  const refTargets = new Set(columns.map(c => c.ref_table));
  const relevance = (item: {name: string; label: string}) => item.name === table && column ? 4 :
    (question.includes(item.name) || item.label && question.includes(item.label) ||
      analyze && (body.source as string).includes(item.name)) ? 3 :
    refTargets.has(item.name) ? 2 : 0;
  const ordered = [...catalogue].sort((a, b) => relevance(b) - relevance(a));
  const tables = ordered.slice(0, 20).map(item => ({
    ...item,
    columns: item.name === table && formulaMode ? columns : columnsOf(item.name),
  }));
  const settings: AiSetting[] = [];
  const settingId = (setting: AiSetting) => `setting_${settings.push(setting) - 1}`;
  const included = new Set(tables.map(item => item.name));
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
    conversation: !analyze ? aiConversation(body.history) : undefined,
    tables: tables.map(item => ({
      name: item.name, label: item.label.slice(0, 100),
      columns: item.columns.slice(0, 30).map(c => ({
        name: c.name, label: c.label.slice(0, 100), type: c.type,
        settingId: c.name === "id" ? undefined : settingId({ kind: "column", table: item.name, name: c.name, label: c.label.slice(0, 100) }),
        ref: c.ref_table && allowed.has(c.ref_table) ? c.ref_table : undefined,
        key: Boolean(c.is_key), calculated: Boolean(c.is_virtual),
      })),
    })),
    settings: [...relatedSettings("slice"), ...relatedSettings("action")],
    scope: "Only the supplied subset is visible. It may be incomplete.",
    target: column ? { table, column: column.name, type: column.type, field } : undefined,
    functions: formulaMode ? FUNCTION_NAMES : undefined,
    originalFormula: analyze ? body.source : undefined,
    measurement,
  };
  usage.set(user.id, used + 1);
  inFlight++;
  try {
    const createProvider = gemini ? geminiProvider : openAiProvider;
    const suggestion = await createProvider(key.trim(), model.trim())(
      { question: question.trim(), context, formula: formulaMode, viewDraft },
      AbortSignal.any([req.signal, AbortSignal.timeout(25_000)]),
    );
    const links = aiSettingLinks(suggestion.references, settings);
    if (viewDraft && development) {
      const proposal = suggestion.viewDraft;
      return reply({ answer: suggestion.answer, formula: null, links,
        viewDraft: proposal && included.has(proposal.table) ? { ...proposal, workspace: development.id } : null });
    }
    if (!column || !suggestion.formula || analyze && suggestion.formula === (body.source as string).trim()) {
      return reply({ answer: suggestion.answer, formula: null, links });
    }
    const validationError = validateAiFormula(suggestion.formula, column, field, table as string, columns, tables);
    return reply({ answer: suggestion.answer, formula: suggestion.formula, validationError, links });
  } catch (error) {
    if (error instanceof AiQuotaError) return reply({ error: gemini
      ? "Gemini API ถึงขีดจำกัดคำขอหรือโควตา กรุณาลองใหม่ภายหลังหรือตรวจโควตาใน Google AI Studio"
      : "เครดิตหรือโควตา OpenAI API ไม่เพียงพอ กรุณาตรวจ Billing ของโปรเจกต์ที่ใช้กับ Builder" }, 503);
    return reply({ error: "ผู้ช่วย AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่" }, 502);
  } finally {
    inFlight--;
  }
});
