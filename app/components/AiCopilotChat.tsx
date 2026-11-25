"use client";

import { useEffect, useRef, useState } from "react";
import type { AiViewDraft } from "../../lib/ai-view-draft";
import { useAuth } from "./AuthProvider";
import AiAnswer from "./AiAnswer";
import Icon from "./Icon";
import "./ai-assist.css";

type Answer = {
  answer: string;
  links?: { kind: "column" | "slice" | "action"; label: string; href: string }[];
  viewDraft?: AiViewDraft & { workspace: string };
};
type Turn = { question: string; result?: Answer; error?: string };

export default function AiCopilotChat() {
  const { workspace, application, user } = useAuth();
  const storageKey = user ? "nocode:copilot:" + JSON.stringify([user.id, application, workspace]) : "";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
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

  async function send(viewDraft = false) {
    const question = message.trim();
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
        body: JSON.stringify({ mode: viewDraft ? "view_draft" : "ask", question, history }),
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
          <AiAnswer answer={result.answer}/>
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
        {workspace !== "live" && <button type="button" onClick={() => send(true)} disabled={pending || !message.trim()}>ร่าง View</button>}
        {!!turns.length && <button type="button" disabled={pending} onClick={() => { setTurns([]); setMessage(""); input.current?.focus(); }}>เริ่มแชตใหม่</button>}
        <small className="hint">Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่ · เลี่ยงการใส่ข้อมูลลับ</small>
      </div>
    </div>
  </div>;
}
