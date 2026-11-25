"use client";

import { useEffect, useRef, useState } from "react";
import type { FormulaField } from "../../lib/columns";
import AiAnswer from "./AiAnswer";
import Icon from "./Icon";
import type { FormulaMeasurement } from "./FormulaPerformancePanel";
import type { AiViewDraft } from "../../lib/ai-view-draft";
import { useAuth } from "./AuthProvider";
import "./ai-assist.css";

type Target = { table: string; column: string; field: FormulaField };
type Suggestion = { answer: string; formula: string | null; validationError?: string | null;
  viewDraft?: AiViewDraft & { workspace: string };
  links?: { kind: "column" | "slice" | "action"; label: string; href: string }[] };
type Profile = { label?: string; error?: string; rows?: number };
type Comparison = { original: Profile; suggested: Profile; equal: boolean | null };
type Sample = Record<string, unknown>;

export default function AiAssistPanel({ target, onInsert, source, compare, measurement, samples }: {
  target?: Target;
  onInsert?: (formula: string) => void;
  source?: string;
  compare?: (formula: string, signal: AbortSignal, sample?: Sample) => Promise<Comparison>;
  samples?: Sample;
  measurement?: FormulaMeasurement & { calculationFailed: boolean };
}) {
  const { workspace } = useAuth();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [cases, setCases] = useState<{ id: number; sample: Sample }[]>([]);
  const nextCase = useRef(1);
  const [comparison, setComparison] = useState<{ label: string; report: Comparison }[] | null>(null);
  const [progress, setProgress] = useState("");
  const [comparing, setComparing] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const canAnalyze = Boolean(target && source?.trim() && source.length <= 4000);

  async function ask(analyze = false, viewDraft = false) {
    if (request.current || (analyze ? !canAnalyze : !question.trim())) return;
    const controller = new AbortController();
    request.current = controller;
    const previous = submitted && result ? [...history, {
      question: submitted,
      answer: result.formula ? `${result.answer}\n\n\`\`\`\n${result.formula}\n\`\`\`` : result.answer,
    }] : history;
    if (!measurement) setHistory(previous);
    setError("");
    setResult(null);
    setComparison(null);
    setSubmitted(analyze ? "วิเคราะห์สูตรนี้" : question.trim());
    if (!analyze) setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyze ? { mode: measurement ? "explain_performance" : "analyze", ...target, source, measurement } :
          { mode: viewDraft ? "view_draft" : target ? "formula" : "ask", ...target, question,
            history: previous.slice(-4).map(turn => ({ question: turn.question.slice(0, 700), answer: turn.answer.slice(0, 1200) })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw Error(data?.error || "ติดต่อผู้ช่วย AI ไม่สำเร็จ");
      if (!controller.signal.aborted) setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "ติดต่อผู้ช่วย AI ไม่สำเร็จ");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function compareSuggestion(formula: string) {
    if (!compare || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setComparing(true);
    setComparison(null);
    setError("");
    try {
      const inputs = cases.length ? cases.map(item => ({ label: `ชุดที่ ${item.id}`, sample: item.sample })) :
        [{ label: "ค่าตัวอย่างปัจจุบัน", sample: samples }];
      const reports = [];
      for (const input of inputs) {
        controller.signal.throwIfAborted();
        setProgress(`${reports.length + 1}/${inputs.length}`);
        reports.push({ label: input.label, report: await compare(formula, controller.signal, input.sample) });
      }
      if (!controller.signal.aborted) setComparison(reports);
    } catch {
      if (!controller.signal.aborted) setError("เปรียบเทียบสูตรไม่สำเร็จ");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setComparing(false);
    }
  }

  return <div className="ai-assist">
    {measurement && <div className="ai-actions">
      <button type="button" disabled={loading || comparing || !canAnalyze} onClick={() => ask(true)}>อธิบายผลวัด</button>
      <small className="hint">{canAnalyze ? "ส่งสูตรและตัวเลขสรุปให้ AI กรุณาตรวจข้อมูลลับในสูตรก่อนส่ง" : "วิเคราะห์ได้เฉพาะสูตรที่ยาวไม่เกิน 4,000 ตัวอักษร"}</small>
    </div>}
    {!measurement && history.map((turn, index) => <div className="ai-chat-turn" key={index}>
      <p className="ai-question">{turn.question}</p>
      <section className="ai-answer"><h3 className="ai-answer-heading"><span aria-hidden="true">✦</span> AI Copilot</h3><AiAnswer answer={turn.answer}/></section>
    </div>)}
    {submitted && !measurement && <p className="ai-question">{submitted}</p>}
    {loading && <div className="ai-answer" role="status"><span className="ai-thinking" aria-hidden="true"/>กำลังรอคำตอบจาก AI…</div>}
    {error && <p className="ai-answer err" role="alert">{error}</p>}
    {result && <section className="ai-answer" aria-label="คำตอบจาก AI Copilot" aria-live="polite">
      <h3 className="ai-answer-heading"><span aria-hidden="true">✦</span> AI Copilot</h3>
      <AiAnswer answer={result.answer}/>
      {result.viewDraft && <div className="ai-formula">
        <h4>ร่าง View ที่เสนอ</h4>
        <p>{result.viewDraft.label} · {result.viewDraft.table} · {result.viewDraft.kind === "table" ? "ตาราง" : "รายการ"}</p>
        <a className="button" href={`/views?${new URLSearchParams({
          aiDraft: result.viewDraft.workspace, label: result.viewDraft.label, table: result.viewDraft.table, kind: result.viewDraft.kind,
        })}`} target="_blank" rel="noopener"><Icon name="external"/>เปิดร่างในตัวแก้ไข View</a>
      </div>}
      {!!result.links?.length && <div className="ai-formula">
        <h4>การตั้งค่าที่เกี่ยวข้อง</h4>
        <div className="ai-actions">{result.links.map(link => <a className="button" key={link.href}
          href={link.href} target="_blank" rel="noopener">
          <Icon name="external"/>{({ column: "คอลัมน์", slice: "Slice", action: "Action" })[link.kind]} · {link.label}
        </a>)}</div>
      </div>}
      {result.formula && target && <>
        <div className="ai-formula"><h4><Icon name="formula"/> สูตรที่ AI เสนอ</h4>
        <pre><code>{result.formula}</code></pre>
        {result.validationError ? <p className="err">{result.validationError}</p> :
          <><small className="hint">ตรวจไวยากรณ์และชนิดผลลัพธ์เบื้องต้นแล้ว แนะนำให้ลองคำนวณกับตัวอย่างก่อนบันทึก</small>
          {compare && source?.trim() &&
            <div className="ai-formula">
              <small className="hint">กรอกค่าที่แท็บลองคำนวณ แล้วกลับมาเพิ่มเป็นชุดตัวอย่างได้สูงสุด 4 ชุด ถ้ายังไม่มีชุด ระบบจะใช้ค่าปัจจุบัน</small>
              {samples && <button type="button" disabled={comparing || cases.length >= 4} onClick={() => {
                const item = { id: nextCase.current++, sample: structuredClone(samples) };
                setCases(previous => [...previous, item]);
                setComparison(null);
              }}>เพิ่มชุดจากค่าปัจจุบัน ({cases.length}/4)</button>}
              {cases.map(item => <div className="ai-actions" key={item.id}>
                <span>ชุดที่ {item.id} · {Object.keys(item.sample).length} ช่อง</span>
                <button type="button" disabled={comparing} aria-label={`ลบชุดที่ ${item.id}`} onClick={() => {
                  setCases(previous => previous.filter(entry => entry.id !== item.id));
                  setComparison(null);
                }}>ลบ</button>
              </div>)}
            </div>
          }
          <div className="ai-actions">
          {compare && source?.trim() &&
            <button type="button" disabled={comparing} onClick={() => compareSuggestion(result.formula!)}>{comparing ? `กำลังเปรียบเทียบ… ${progress}` : "เปรียบเทียบกับสูตรเดิม"}</button>
          }
          <button type="button" className="primary" disabled={comparing} onClick={() => onInsert?.(result.formula!)}>นำสูตรไปใส่ในช่องแก้ไข</button></div></>}
        </div>
      </>}
    </section>}
    {comparison && <div role="status">
      <p><strong>ตรงกัน {comparison.filter(item => item.report.equal === true).length} · ต่างกัน {comparison.filter(item => item.report.equal === false).length} · เปรียบเทียบไม่ได้ {comparison.filter(item => item.report.equal === null).length}</strong></p>
      {comparison.map(({ label, report }) => <div key={label} className="ai-answer ai-comparison">
      <strong>{label} · {report.equal === null ? "เปรียบเทียบผลไม่ได้" : report.equal ? "ผลลัพธ์ตรงกัน" : "ผลลัพธ์ต่างกัน"}</strong>
      <table>
        <thead><tr><th>สูตร</th><th>ผลลัพธ์</th><th>แถวที่โหลดรวม</th></tr></thead>
        <tbody>
          <tr><th scope="row">สูตรเดิม</th><td>{report.original.error ?? report.original.label}</td><td>{report.original.rows?.toLocaleString("th-TH") ?? "—"}</td></tr>
          <tr><th scope="row">สูตรที่ AI เสนอ</th><td>{report.suggested.error ?? report.suggested.label}</td><td>{report.suggested.rows?.toLocaleString("th-TH") ?? "—"}</td></tr>
        </tbody>
      </table>
      </div>)}
      <small className="hint">จำนวนแถวนับการอ่านซ้ำ ผลอาจต่างเมื่อข้อมูลเปลี่ยนระหว่างการทดสอบ</small>
    </div>}
    {!measurement && <div className="ai-chat-composer ai-formula-composer">
      <div className="ai-chat-input">
        <textarea rows={1} maxLength={1500} value={question} aria-label="คำถามสำหรับ AI"
          placeholder={submitted ? "ถามต่อเกี่ยวกับสูตร…" : "อธิบายว่าต้องการให้สูตรทำอะไร…"}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            if (!comparing) void ask();
          }}/>
        <button type="button" className="primary" onClick={() => ask()} disabled={loading || comparing || !question.trim()}>ส่ง</button>
      </div>
      <div className="ai-actions">
        {!target && workspace !== "live" && <button type="button" onClick={() => ask(false, true)} disabled={loading || !question.trim()}>ร่าง View</button>}
        {target && <button type="button" onClick={() => ask(true)} disabled={loading || comparing || !canAnalyze}>วิเคราะห์สูตรนี้</button>}
        <small className="hint">Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่ · เลี่ยงการใส่ข้อมูลลับ</small>
      </div>
    </div>}
  </div>;
}
