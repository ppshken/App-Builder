"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AiViewDraft } from "../../lib/ai-view-draft";
import type { AiAutomationDraft } from "../../lib/ai-automation-draft";
import type { AiDataDesign, AiRequirementReview } from "../../lib/ai-data-design";
import { aiDataDesignStatus, isAiSchemaRequest } from "../../lib/ai-data-design";
import { useAuth } from "./AuthProvider";
import AiAnswer from "./AiAnswer";
import Icon from "./Icon";
import type { Column } from "@/lib/columns";
import "./ai-assist.css";

const ColumnConversionDialog = dynamic(() => import("./ColumnConversionDialog"));

type Answer = {
  answer: string;
  links?: { kind: "column" | "slice" | "action"; label: string; href: string }[];
  viewDraft?: AiViewDraft & { workspace: string };
  automationDraft?: AiAutomationDraft & { workspace: string };
  dataDesign?: AiDataDesign;
  designWorkspace?: string;
  designApplied?: boolean;
  conversionResult?: string;
  invalidDesign?: boolean;
  designAttempt?: boolean;
};
type Turn = { question: string; result?: Answer; error?: string };
type ConversionTable = { name: string; label: string; columns: Column[]; source_kind?: string };

export default function AiCopilotChat() {
  const { workspace, application, user } = useAuth();
  const storageKey = user ? "nocode:copilot:" + JSON.stringify([user.id, application, workspace]) : "";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [designConfirm, setDesignConfirm] = useState<number | null>(null);
  const [designSaving, setDesignSaving] = useState(false);
  const [designError, setDesignError] = useState("");
  const [requirementReview, setRequirementReview] = useState<{index:number; data:AiRequirementReview} | null>(null);
  const [conversionError, setConversionError] = useState<{index:number; message:string} | null>(null);
  const [conversion, setConversion] = useState<{
    index: number; tables: ConversionTable[]; column: Column; target: NonNullable<AiDataDesign["conversion"]>;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  async function openConversion(result: Answer, index: number) {
    const target = result.dataDesign?.conversion;
    if (!target || result.designWorkspace !== workspace || designSaving) return;
    setConversionError(null);
    setDesignSaving(true);
    try {
      const response = await fetch("/api/tables", {cache:"no-store"});
      if (!response.ok || response.headers.get("x-nocode-workspace") !== workspace)
        throw Error("โหลดโครงสร้างปัจจุบันไม่ได้ กรุณาตรวจพื้นที่พัฒนาแล้วลองใหม่");
      const tables: ConversionTable[] = await response.json();
      const column = tables.find(table => table.name === target.table)?.columns.find(column => column.name === target.column);
      if (!column || column.is_virtual) throw Error("ไม่พบคอลัมน์จริงตามแผน กรุณาสร้างแผนใหม่");
      setConversion({index, tables:tables.filter(table => table.source_kind !== "EXTERNAL_REST_API"), column, target});
    } catch (error) {
      setConversionError({index,message:error instanceof Error ? error.message : "เปิดหน้าตรวจการแปลงไม่สำเร็จ"});
    } finally {
      setDesignSaving(false);
    }
  }
  async function applyDesign(result: Answer, index: number, preview = false) {
    if (designSaving || !result.dataDesign || result.designWorkspace !== workspace) return;
    setDesignSaving(true);
    setDesignError("");
    try {
      const response = await fetch("/api/ai/design" + (preview ? "?preview=1" : ""), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, design: result.dataDesign,
          fingerprint: requirementReview?.index === index ? requirementReview.data.fingerprint : undefined }),
      });
      const data = await response.json();
      if (result.dataDesign.requirement) {
        setRequirementReview(data?.review && response.ok ? {index,data:data.review} : null);
      }
      if (!response.ok) throw new Error(data.error || "นำแผนไปใช้ไม่สำเร็จ");
      if (preview) return;
      setTurns(previous => previous.map((turn, i) => i === index && turn.result === result
        ? { ...turn, result: { ...result, designApplied: true } } : turn));
      setDesignConfirm(null);
      window.dispatchEvent(new Event("nocode:metadata"));
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : "นำแผนไปใช้ไม่สำเร็จ");
    } finally {
      setDesignSaving(false);
    }
  }
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    let saved: Turn[] = [];
    try {
      const parsed = storageKey ? JSON.parse(sessionStorage.getItem(storageKey) || "[]") : [];
      if (Array.isArray(parsed)) saved = parsed.slice(-30).filter(turn => turn && typeof turn.question === "string" &&
        (typeof turn.result?.answer === "string" || typeof turn.error === "string"));
    } catch {
      // ใช้บทสนทนาชั่วคราวได้เมื่อเบราว์เซอร์ปิดการเก็บข้อมูล
    }
    setTurns(saved);
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      if (turns.length) sessionStorage.setItem(storageKey, JSON.stringify(turns.filter(turn => turn.result || turn.error).slice(-30)));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // ข้อจำกัดพื้นที่เก็บข้อมูลไม่ขัดขวางการส่งข้อความ
    }
  }, [storageKey, loadedKey, turns]);
  useEffect(() => {
    const element = feed.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns, pending]);

  async function send(mode: "ask" | "view_draft" | "automation_draft" | "data_design" = "ask") {
    const question = message.trim();
    if (mode === "ask" && isAiSchemaRequest(question)) mode = "data_design";
    if (!question || controller.current || loadedKey !== storageKey) return;
    const request = new AbortController();
    controller.current = request;
    setMessage("");
    setPending(true);
    setTurns(previous => [...previous, { question }]);
    const finish = (turn: Turn) => setTurns(previous => [...previous.slice(0, -1), turn]);
    const history = turns.flatMap(turn => turn.result ? [{
      question: turn.question.slice(0, 700),
      answer: turn.result.answer.slice(0, 1200),
    }] : []).slice(-4);
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST", signal: request.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, question, history }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.answer !== "string") throw Error(result?.error || "ติดต่อ AI Copilot ไม่สำเร็จ");
      if (!request.signal.aborted) finish({ question, result });
    } catch (error) {
      if (!request.signal.aborted) finish({ question, error: error instanceof Error ? error.message : "ติดต่อ AI Copilot ไม่สำเร็จ" });
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return <div className="ai-chat">
    <div ref={feed} className="ai-chat-feed" role="log" aria-label="บทสนทนากับ AI Copilot" tabIndex={0}>
      {!turns.length && <div className="ai-chat-empty"><span aria-hidden="true">✦</span>
        <h3>ถามเกี่ยวกับแอปนี้ได้เลย</h3><p className="hint">เช่น ตารางไหนเชื่อมกับตารางรายการตรวจ หรือช่วยอธิบายสูตรที่กำลังใช้</p>
      </div>}
      {turns.map(({ question, result, error }, index) => <div className="ai-chat-turn" key={index}>
        <p className="ai-question">{question}</p>
        {result && <section className="ai-answer" aria-label="คำตอบจาก AI Copilot">
          <h3 className="ai-answer-heading"><span aria-hidden="true">✦</span> AI Copilot</h3>
          <AiAnswer answer={result.designAttempt || result.dataDesign || !result.invalidDesign && !isAiSchemaRequest(question)
            ? result.answer : aiDataDesignStatus(false, false, !!result.invalidDesign)}/>
          {!result.dataDesign && (result.designAttempt || result.invalidDesign || isAiSchemaRequest(question)) && <div className="ai-actions">
            <button type="button" onClick={() => {setMessage(question); input.current?.focus();}}>นำคำสั่งกลับมาแก้</button>
          </div>}
          {result.dataDesign && <div className="ai-formula">
            <h4>โครงสร้างข้อมูลที่เสนอ</h4>
            {result.dataDesign.tables.map(table => <section key={table.name} className="ai-answer ai-comparison">
              <h4>{table.label} · <code>{table.name}</code></h4>
              <table>
                <thead><tr><th>คอลัมน์</th><th>ชนิด</th><th>อ้างอิง / บังคับกรอก</th></tr></thead>
                <tbody>
                  <tr><th scope="row"><code>id</code></th><td>Number</td><td>Key ของระบบ</td></tr>
                  {table.columns.map(column => <tr key={column.name}>
                    <th scope="row">{column.label}<br/><code>{column.name}</code></th>
                    <td>{column.type}</td>
                    <td>{column.ref && <code>{column.ref}</code>}{column.ref && column.required ? " · " : ""}{column.required ? "บังคับ" : !column.ref && !column.formula ? "—" : null}
                      {column.formula && <div>สูตรคำนวณ<br/><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{column.formula}</code></div>}
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </section>)}
            {!!result.dataDesign.changes?.length && <ul>
              {result.dataDesign.changes.map((change, i) => <li key={i}>
                <code>{change.table}</code>{" · "}
                {change.kind === "add_column"
                  ? <>เพิ่ม {change.column.formula ? "คอลัมน์คำนวณ " : ""}{change.column.label} (<code>{change.column.name}</code>, {change.column.type}{change.column.ref && <> → <code>{change.column.ref}</code></>})
                    {change.column.formula && <div><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.column.formula}</code></div>}
                  </>
                  : change.kind === "edit_formula" || change.kind === "edit_default" || change.kind === "edit_validation"
                    ? <>{change.kind === "edit_validation" ? "ตั้งเงื่อนไข Valid_If " : change.kind === "edit_default" ? "ตั้งสูตรค่าเริ่มต้นสำหรับแถวใหม่ " : "แก้สูตรคอลัมน์ "}<code>{change.column}</code>
                      <div>สูตรเดิม<br/><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.previousFormula || "—"}</code></div>
                      <div>สูตรใหม่<br/><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.formula}</code></div>
                      {change.kind === "edit_default" && <small className="hint">หากเปิด Reset on edit คอลัมน์จะใช้สูตรนี้เมื่อเข้าเงื่อนไขรีเซ็ตด้วย</small>}
                      {change.kind === "edit_validation" && change.message !== undefined && <>
                        <div>ข้อความเดิม · {change.previousMessage || "ใช้ข้อความมาตรฐาน"}</div>
                        <div>ข้อความใหม่ · {change.message || "ใช้ข้อความมาตรฐาน"}</div>
                      </>}
                    </>
                  : change.kind === "rename_label"
                    ? <>เปลี่ยนชื่อที่แสดงของ <code>{change.column}</code> เป็น {change.label}</>
                    : <>ใช้ <code>{change.column}</code> เป็น Label ของรายการ</>}
              </li>)}
            </ul>}
            {result.dataDesign.requirement && <p><code>{result.dataDesign.requirement.table}[{result.dataDesign.requirement.column}]</code>
              {" · "}{result.dataDesign.requirement.required ? "เปิดการบังคับกรอก" : "ปิดการบังคับกรอก"}</p>}
            {result.dataDesign.conversion ? <>
              <p><code>{result.dataDesign.conversion.table}[{result.dataDesign.conversion.column}]</code>
                {" → "}{result.dataDesign.conversion.type}{result.dataDesign.conversion.ref && <> · <code>{result.dataDesign.conversion.ref}</code></>}
              </p>
              {result.conversionResult ? <p role="status">{result.conversionResult}</p>
                : result.designWorkspace === workspace && <button type="button" className="button" disabled={designSaving}
                  onClick={() => void openConversion(result, index)}>เปิดหน้าตรวจการแปลง</button>}
              {conversionError?.index === index && <p className="err" role="alert">{conversionError.message}</p>}
            </> : result.designApplied ? <p role="status">นำแผนไปใช้ในพื้นที่พัฒนาแล้ว</p>
              : result.designWorkspace && result.designWorkspace === workspace ? (
                designConfirm === index ? <>
                  <p>ยืนยันนำรายการเปลี่ยนแปลงด้านบนไปใช้ในพื้นที่พัฒนาโครงสร้าง</p>
                  {designError && <p className="err" role="alert">{designError}</p>}
                  {result.dataDesign.requirement && requirementReview?.index === index && <div role="status">
                    <p>ข้อมูลทดสอบในพื้นที่พัฒนา {requirementReview.data.total} แถว · ค่าว่างหรืออ่านค่าไม่ได้ {requirementReview.data.invalid} แถว</p>
                    {!!requirementReview.data.sampleIds.length && <p>รหัสแถวตัวอย่าง {requirementReview.data.sampleIds.join(", ")}</p>}
                    {requirementReview.data.conditional && <p>สูตร Required_If ยังมีผลตามเงื่อนไขเดิม</p>}
                    <p>ข้อมูลเวอร์ชันจริงจะตรวจแยกในขั้นตอนซ้อมเผยแพร่</p>
                  </div>}
                  <div className="ai-actions">
                    <button type="button" className="button" disabled={designSaving} onClick={() => setDesignConfirm(null)}>ยกเลิก</button>
                    {result.dataDesign.requirement && <button type="button" className="button" disabled={designSaving}
                      onClick={() => void applyDesign(result, index, true)}>ตรวจข้อมูล</button>}
                    <button type="button" className="button" disabled={designSaving || !!result.dataDesign.requirement &&
                      (requirementReview?.index !== index || !!requirementReview.data.invalid)} onClick={() => void applyDesign(result, index)}>
                      {designSaving ? "กำลังนำแผนไปใช้…" : "ยืนยันและนำไปใช้"}
                    </button>
                  </div>
                </> : <button type="button" className="button" disabled={designSaving} onClick={() => {
                  setDesignError(""); setRequirementReview(null); setDesignConfirm(index);
                }}>ตรวจแผนและนำไปใช้</button>
              ) : <p className="hint">เปิดพื้นที่พัฒนาโครงสร้าง แล้วสร้างแผนที่นั่นเพื่อนำไปใช้</p>}
          </div>}
          {!!result.links?.length && <div className="ai-actions">{result.links.map(link => <a className="button" key={link.href}
            href={link.href} target="_blank" rel="noopener"><Icon name="external"/>
            {({ column: "คอลัมน์", slice: "Slice", action: "Action" })[link.kind]} · {link.label}</a>)}</div>}
          {result.viewDraft && <div className="ai-formula">
            <h4>ร่าง View ที่เสนอ</h4>
            <p>{result.viewDraft.label} · {result.viewDraft.table} · {result.viewDraft.kind === "table" ? "ตาราง" : "รายการ"}</p>
            <a className="button" href={`/views?${new URLSearchParams({
              aiDraft: result.viewDraft.workspace, label: result.viewDraft.label, table: result.viewDraft.table, kind: result.viewDraft.kind,
            })}`} target="_blank" rel="noopener">เปิดร่างในตัวแก้ไข View</a>
          </div>}
          {result.automationDraft && <div className="ai-formula">
            <h4>ร่าง Automation ที่เสนอ</h4>
            <dl>
              <dt>ชื่อ</dt><dd>{result.automationDraft.label}</dd>
              <dt>ตาราง</dt><dd>{result.automationDraft.table}</dd>
              <dt>เหตุการณ์</dt><dd>{({manual:"สั่งเอง",create:"เมื่อเพิ่มข้อมูล",update:"เมื่อแก้ไขข้อมูล"})[result.automationDraft.event]}</dd>
              <dt>Action</dt><dd>{result.automationDraft.action}</dd>
            </dl>
            <a className="button" href={`/workflows?${new URLSearchParams({
              aiDraft: result.automationDraft.workspace, label: result.automationDraft.label, table: result.automationDraft.table,
              event: result.automationDraft.event, action: result.automationDraft.action,
            })}`} target="_blank" rel="noopener">เปิดร่างใน Automation</a>
          </div>}
        </section>}
        {error && <div className="ai-answer err" role="alert">{error} <button type="button" onClick={() => {
          setMessage(question); input.current?.focus();
        }}>นำคำถามกลับมาแก้</button></div>}
        {!result && !error && <div className="ai-answer" role="status"><span className="ai-thinking" aria-hidden="true"/>กำลังประมวลผล…</div>}
      </div>)}
    </div>
    <div className="ai-chat-composer">
      <div className="ai-chat-input">
        <textarea ref={input} rows={2} maxLength={1500} value={message} aria-label="ข้อความถึง AI Copilot"
          placeholder={turns.length ? "ถามต่อ…" : "พิมพ์ข้อความ…"} onChange={event => setMessage(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            void send();
          }}/>
        <button type="button" className="primary" onClick={() => send()} disabled={pending || !message.trim()}>ส่ง</button>
      </div>
      <div className="ai-actions">
        <button type="button" onClick={() => send("data_design")} disabled={pending || !message.trim()}>ออกแบบโครงสร้างข้อมูล</button>
        {workspace !== "live" && <>
          <button type="button" onClick={() => send("view_draft")} disabled={pending || !message.trim()}>ร่าง View</button>
          <button type="button" onClick={() => send("automation_draft")} disabled={pending || !message.trim()}>ร่าง Automation</button>
        </>}
        {!!turns.length && <button type="button" disabled={pending || designSaving} onClick={() => { setTurns([]); setMessage(""); setDesignConfirm(null); input.current?.focus(); }}>เริ่มแชตใหม่</button>}
        <small className="hint">{isAiSchemaRequest(message)
          ? "ส่งคำสั่งนี้เพื่อสร้างแผนโครงสร้าง ระบบจะรอให้คุณตรวจและยืนยัน"
          : "Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่ · เลี่ยงการใส่ข้อมูลลับ"}</small>
      </div>
    </div>
    {conversion && <ColumnConversionDialog table={conversion.target.table} column={conversion.column}
      tables={conversion.tables} designWorkspace={workspace}
      initialTarget={{type:conversion.target.type,ref_table:conversion.target.ref,options:conversion.target.options ?? ""}}
      onClose={() => setConversion(null)}
      onSaved={async message => {
        setTurns(previous => previous.map((turn, i) => i === conversion.index && turn.result
          ? {...turn,result:{...turn.result,conversionResult:message}} : turn));
        window.dispatchEvent(new Event("nocode:metadata"));
      }} />}
  </div>;
}
