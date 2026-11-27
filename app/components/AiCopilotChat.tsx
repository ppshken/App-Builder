"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AiViewDraft } from "../../lib/ai-view-draft";
import type { AiAutomationDraft } from "../../lib/ai-automation-draft";
import type { AiDataDesign, AiRequirementReview } from "../../lib/ai-data-design";
import { aiConversionChangesColumn, aiDataDesignStatus, updateAiEnumOptions, isAiFormulaEdit, isAiSchemaRequest } from "../../lib/ai-data-design";
import { useAuth } from "./AuthProvider";
import AiAnswer from "./AiAnswer";
import Icon from "./Icon";
import type { Column } from "@/lib/columns";
import type { AiContextCoverage } from "@/lib/ai-context";
import "./ai-assist.css";

const ColumnConversionDialog = dynamic(() => import("./ColumnConversionDialog"));

type Answer = {
  choices?: {label: string; name: string; instruction: string}[];
  coverage?: AiContextCoverage;
  answer: string;
  links?: { kind: "column" | "slice" | "action"; label: string; href: string }[];
  viewDraft?: AiViewDraft & { workspace: string };
  automationDraft?: AiAutomationDraft & { workspace: string };
  dataDesign?: AiDataDesign;
  designWorkspace?: string;
  designApplied?: boolean;
  designReceipt?: string;
  conversionResult?: string;
  nextConversion?: AiDataDesign["conversion"];
  nextRequirement?: AiDataDesign["requirement"];
  enumAdditions?: string[];
  enumRemovals?: string[];
  invalidDesign?: boolean;
  designAttempt?: boolean;
};
type Turn = { question: string; result?: Answer; error?: string };
type PlanHistoryItem = {planId:string;kind:"schema"|"required";reviewedAt:number;expiresAt:number;authorizedAt:number|null;approvedAt:number|null;receiptId:string|null;canUndo:boolean;revertedAt:number|null;hasPayload:number;cancelledAt:number|null};
type ConversionTable = { name: string; label: string; columns: Column[]; source_kind?: string };

export default function AiCopilotChat() {
  const { workspace, application, user } = useAuth();
  const storageKey = user ? "nocode:copilot:" + JSON.stringify([user.id, application, workspace]) : "";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [focus, setFocus] = useState("auto");
  const [pending, setPending] = useState(false);
  const [designConfirm, setDesignConfirm] = useState<number | null>(null);
  const [designSaving, setDesignSaving] = useState(false);
  const [designError, setDesignError] = useState("");
  const [requirementReview, setRequirementReview] = useState<{index:number; data:AiRequirementReview} | null>(null);
  const [schemaReview, setSchemaReview] = useState<{index:number; fingerprint:string;planId:string;expiresAt:number} | null>(null);
  const [authorizedPlan, setAuthorizedPlan] = useState<string|null>(null);
  const [planHistory, setPlanHistory] = useState<{plans:PlanHistoryItem[]}|{error:string}|null>(null);
  const [historyLoading,setHistoryLoading] = useState(false);
  const [undoConfirm,setUndoConfirm] = useState<string|null>(null);
  const [undoError,setUndoError] = useState("");
  const [conversionError, setConversionError] = useState<{index:number; message:string} | null>(null);
  const [conversion, setConversion] = useState<{
    index: number; tables: ConversionTable[]; column: Column; target: NonNullable<AiDataDesign["conversion"]>;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  async function resumePlan(planId:string) {
    if (pending || historyLoading || designSaving) return;
    setHistoryLoading(true);
    setUndoError("");
    try {
      const response = await fetch("/api/ai/design?" + new URLSearchParams({planId}),{cache:"no-store"});
      const data = await response.json();
      if (!response.ok || data.workspace !== workspace) throw Error(data.error || "เปิดแผนต่อไม่สำเร็จ");
      const index = turns.length;
      const design = data.design as AiDataDesign;
      setTurns(previous => [...previous,{question:"เปิดแผนจากประวัติ",
        result:{answer:"อนุมัติแผนแล้ว ตรวจรายละเอียดก่อนนำไปใช้",dataDesign:design,designWorkspace:workspace,designAttempt:true}}]);
      setDesignError("");
      setRequirementReview(design.requirement ? {index,data:data.review} : null);
      setSchemaReview(design.requirement ? null : {index,...data.review});
      setAuthorizedPlan(planId);
      setDesignConfirm(index);
      setPlanHistory(null);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : "เปิดแผนต่อไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  }
  function reviewFor(result:Answer,index:number) {
    return result.dataDesign?.requirement
      ? (requirementReview?.index === index && !requirementReview.data.invalid ? requirementReview.data : null)
      : (schemaReview?.index === index ? schemaReview : null);
  }
  async function approvePlan(result:Answer,index:number) {
    const review = reviewFor(result,index);
    if (designSaving || !review?.planId) return;
    setDesignSaving(true);
    setDesignError("");
    try {
      const response = await fetch("/api/ai/design",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({op:"approve",workspace,planId:review.planId,fingerprint:review.fingerprint})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "อนุมัติแผนไม่สำเร็จ");
      setAuthorizedPlan(review.planId);
      setPlanHistory(null);
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : "อนุมัติแผนไม่สำเร็จ");
    } finally {
      setDesignSaving(false);
    }
  }
  async function updatePlanHistory(planId:string,op:"undo"|"cancel") {
    setHistoryLoading(true);
    setUndoError("");
    try {
      const response = await fetch("/api/ai/design",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({op,workspace,planId,confirm:true})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "จัดการแผนไม่สำเร็จ");
      setUndoConfirm(null);
      if (op === "undo") window.dispatchEvent(new Event("nocode:metadata"));
      if (op === "cancel" && (schemaReview?.planId === planId || requirementReview?.data.planId === planId)) {
        setSchemaReview(null);
        setRequirementReview(null);
        setAuthorizedPlan(null);
        setDesignConfirm(null);
      }
      await loadPlanHistory();
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : "จัดการแผนไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  }
  async function loadPlanHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/ai/design",{cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "เปิดประวัติแผนไม่สำเร็จ");
      setPlanHistory({plans:data.plans});
    } catch (error) {
      setPlanHistory({error:error instanceof Error ? error.message : "เปิดประวัติแผนไม่สำเร็จ"});
    } finally {
      setHistoryLoading(false);
    }
  }
  async function openConversion(result: Answer, index: number) {
    let target = result.dataDesign?.conversion ?? (result.designApplied ? result.nextConversion : undefined);
    if (!target || result.designWorkspace !== workspace || designSaving) return;
    setConversionError(null);
    setDesignSaving(true);
    try {
      const response = await fetch("/api/tables", {cache:"no-store"});
      if (!response.ok || response.headers.get("x-nocode-workspace") !== workspace)
        throw Error("โหลดโครงสร้างปัจจุบันไม่ได้ กรุณาตรวจพื้นที่พัฒนาแล้วลองใหม่");
      const tables: ConversionTable[] = await response.json();
      if (target.type === "ref" && !tables.some(table => table.name === target.ref && table.source_kind !== "EXTERNAL_REST_API"))
        throw Error("ไม่พบตารางปลายทาง Ref ในพื้นที่พัฒนานี้ กรุณาตรวจตารางแล้วลองใหม่");
      const column = tables.find(table => table.name === target.table)?.columns.find(column => column.name === target.column);
      if (!column || column.is_virtual) throw Error("ไม่พบคอลัมน์จริงตามแผน กรุณาสร้างแผนใหม่");
      if (result.enumRemovals || result.enumAdditions) {
        const options = column.type === target.type ? updateAiEnumOptions(column, result.enumAdditions, result.enumRemovals) : null;
        if (options === null) throw Error("การตั้งค่าคอลัมน์เปลี่ยนแล้ว กรุณาตรวจชนิดข้อมูลหรือสร้างแผนใหม่");
        target = {...target,options};
      }
      if (!aiConversionChangesColumn(column, target)) {
        setTurns(previous => previous.map((turn, i) => i === index && turn.result
          ? {...turn,result:{...turn.result,conversionResult:"โครงสร้างล่าสุดใช้การตั้งค่าตามแผนแล้ว"}} : turn));
        return;
      }
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
        body: JSON.stringify({ workspace, design: result.dataDesign, reviewed:true,
          planId: result.dataDesign.requirement ? requirementReview?.data.planId : schemaReview?.planId,
          fingerprint: result.dataDesign.requirement
            ? (requirementReview?.index === index ? requirementReview.data.fingerprint : undefined)
            : (schemaReview?.index === index ? schemaReview.fingerprint : undefined) }),
      });
      const data = await response.json();
      if (result.dataDesign.requirement) {
        setRequirementReview(data?.review && response.ok ? {index,data:data.review} : null);
      } else {
        setSchemaReview(preview && response.ok && typeof data?.review?.fingerprint === "string" && typeof data.review.planId === "string"
          ? {index,fingerprint:data.review.fingerprint,planId:data.review.planId,expiresAt:data.review.expiresAt} : null);
      }
      if (!response.ok) throw new Error(data.error || "นำแผนไปใช้ไม่สำเร็จ");
      if (preview) return;
      setTurns(previous => previous.map((turn, i) => i === index && turn.result === result
        ? { ...turn, result: { ...result, designApplied: true, designReceipt: data.receiptId } } : turn));
      setDesignConfirm(null);
      setPlanHistory(null);
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
    if (!question || controller.current || loadedKey !== storageKey || historyLoading) return;
    const request = new AbortController();
    controller.current = request;
    setMessage("");
    setPending(true);
    setTurns(previous => [...previous, { question }]);
    const finish = (turn: Turn) => setTurns(previous => [...previous.slice(0, -1), turn]);
    const history = turns.flatMap(turn => {
      if (!turn.result) return [];
      const plan = turn.result.dataDesign;
      const targets = plan?.conversion
        ? [plan.conversion.table, plan.conversion.column, plan.conversion.ref].filter(Boolean)
        : [...(plan?.tables.map(table => table.name) ?? []), ...(plan?.changes?.map(change =>
          change.table + "." + (change.kind === "add_column" ? change.column.name : change.column)) ?? [])];
      const outcome = turn.result.conversionResult
        ?? (turn.result.designApplied ? "Builder ยืนยันว่าบันทึกแผนในพื้นที่พัฒนาแล้ว" : turn.result.answer);
      return [{
        question: turn.question.slice(0, 700),
        answer: [targets.join(", "), outcome].filter(Boolean).join("\n").slice(0, 1200),
      }];
    }).slice(-4);
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST", signal: request.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, question, history, focus }),
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

  return <div className="ai-chat-layout"><div className="ai-chat">
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
          {result.coverage && (result.coverage.tablesIncluded < result.coverage.tablesAvailable ||
            result.coverage.columnsIncluded < result.coverage.columnsAvailableInSelectedTables) && <small className="hint">
            บริบทที่ใช้ {result.coverage.tablesIncluded}/{result.coverage.tablesAvailable} ตาราง · {result.coverage.columnsIncluded}/{result.coverage.columnsAvailableInSelectedTables} คอลัมน์ในตารางที่เลือก
          </small>}
          {!result.dataDesign && (result.designAttempt || result.invalidDesign || isAiSchemaRequest(question)) && <div className="ai-actions">
            {result.choices?.map(choice => <button type="button" key={choice.name} disabled={pending || designSaving}
              onClick={() => {setMessage(question.slice(0, 1499 - choice.instruction.length) + "\n" + choice.instruction); input.current?.focus();}}>
              {choice.label} · <code>{choice.name}</code>
            </button>)}
            <button type="button" onClick={() => {setMessage(question); input.current?.focus();}}>นำคำสั่งกลับมาแก้</button>
          </div>}
          {result.dataDesign && <div className="ai-formula">
            <h4>โครงสร้างข้อมูลที่เสนอ</h4>
            {result.nextRequirement && <div>
              <p>หลังเพิ่มคอลัมน์ · ตรวจข้อมูลก่อนบังคับกรอก <code>{result.nextRequirement.table}.{result.nextRequirement.column}</code></p>
              {result.designApplied && result.designWorkspace === workspace && <button type="button" disabled={pending || designSaving}
                onClick={() => {
                  const requirement = result.nextRequirement!;
                  setTurns(previous=>[...previous,{question:`บังคับกรอก ${requirement.table}.${requirement.column}`,
                    result:{answer:"ตรวจข้อมูลเดิมก่อนเปิดการบังคับกรอก",designWorkspace:workspace,
                      dataDesign:{tables:[],requirement},designAttempt:true}}]);
                }}>ตรวจการบังคับกรอกขั้นถัดไป</button>}
            </div>}
            {result.enumAdditions?.length ? <p>ตัวเลือกที่จะเพิ่ม · {result.enumAdditions.join(", ")}</p> : null}
            {result.enumRemovals?.length ? <p>ตัวเลือกที่จะลบ · {result.enumRemovals.join(", ")}</p> : null}
            {!!result.dataDesign.views?.length && <ul>{result.dataDesign.views.map((view,index) => <li key={index}>
              เพิ่ม View {view.label} · {view.kind === "table" ? "ตาราง" : "รายการ"} · <code>{view.table}</code> · เมนู
            </li>)}</ul>}
            {!!result.dataDesign.actions?.length && <ul>{result.dataDesign.actions.map(action => <li key={action.name}>
              เพิ่ม Action {action.label} · อัปเดตแถวใน <code>{action.table}</code>
              <div>เงื่อนไข <code>{action.condition}</code></div>
              <ul>{action.updates.map(update => <li key={update.column}><code>{update.column}</code> = <code>{update.formula}</code></li>)}</ul>
            </li>)}</ul>}
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
                      {column.options && <div>ตัวเลือก · {column.options}</div>}
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
                    {change.column.options && <div>ตัวเลือก · {change.column.options}</div>}
                    {change.column.formula && <div><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.column.formula}</code></div>}
                  </>
                  : isAiFormulaEdit(change)
                    ? <>{change.kind === "edit_required_if" ? "บังคับกรอกเมื่อ (Required_If) " : change.kind === "edit_show" ? "แสดงเมื่อ (Show_If) " : change.kind === "edit_editable" ? "แก้ไขเมื่อ (Editable_If) " : change.kind === "edit_validation" ? "ตั้งเงื่อนไข Valid_If " : change.kind === "edit_default" ? "ตั้งสูตรค่าเริ่มต้นสำหรับแถวใหม่ " : "แก้สูตรคอลัมน์ "}<code>{change.column}</code>
                      <div>สูตรเดิม<br/><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.previousFormula || "—"}</code></div>
                      <div>สูตรใหม่<br/><code style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.formula || "ล้างสูตร"}</code></div>
                      {change.kind === "edit_default" && <small className="hint">หากเปิด Reset on edit คอลัมน์จะใช้สูตรนี้เมื่อเข้าเงื่อนไขรีเซ็ตด้วย</small>}
                      {change.kind === "edit_required_if" && <small className="hint">ถ้าเปิดบังคับกรอกอยู่ ช่องนี้ยังบังคับกรอกทุกแถว</small>}
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
            {result.nextConversion && <div>
              <p>ขั้นถัดไป · ตรวจการเปลี่ยน <code>{result.nextConversion.table}.{result.nextConversion.column}</code> เป็น <code>{result.nextConversion.type}</code>
                {result.nextConversion.ref && <> ไปยัง <code>{result.nextConversion.ref}</code></>}
                {result.nextConversion.options && <> · ตัวเลือก {result.nextConversion.options}</>}
              </p>
              {result.conversionResult ? <p role="status">{result.conversionResult}</p>
                : result.designApplied && result.designWorkspace === workspace && <button type="button" className="button" disabled={designSaving}
                  onClick={() => void openConversion(result, index)}>{result.nextConversion.type === "ref" ? "เปิดหน้าตรวจ Ref ขั้นถัดไป" : "เปิดหน้าตรวจการแปลงขั้นถัดไป"}</button>}
              {conversionError?.index === index && <p className="err" role="alert">{conversionError.message}</p>}
            </div>}
            {result.dataDesign.conversion ? <>
              <p><code>{result.dataDesign.conversion.table}[{result.dataDesign.conversion.column}]</code>
                {" → "}{result.dataDesign.conversion.type}{result.dataDesign.conversion.ref && <> · <code>{result.dataDesign.conversion.ref}</code></>}
                {result.dataDesign.conversion.options && <> · ตัวเลือก {result.dataDesign.conversion.options}</>}
              </p>
              {result.conversionResult ? <p role="status">{result.conversionResult}</p>
                : result.designWorkspace === workspace && <button type="button" className="button" disabled={designSaving}
                  onClick={() => void openConversion(result, index)}>เปิดหน้าตรวจการแปลง</button>}
              {conversionError?.index === index && <p className="err" role="alert">{conversionError.message}</p>}
            </> : result.designApplied ? <><p role="status">{result.nextConversion ? "บันทึกขั้นแรกในพื้นที่พัฒนาแล้ว" : "นำแผนไปใช้ในพื้นที่พัฒนาแล้ว"}</p>
              {result.designReceipt && <small className="hint">รหัสยืนยันผล <code>{result.designReceipt}</code></small>}</>
              : result.designWorkspace && result.designWorkspace === workspace ? (
                designConfirm === index ? <>
                  <p>ยืนยันนำรายการเปลี่ยนแปลงด้านบนไปใช้ในพื้นที่พัฒนาโครงสร้าง</p>
                  {designError && <p className="err" role="alert">{designError}</p>}
                  {schemaReview?.index === index && <p role="status">ผ่านการทดลองแผน ยังไม่ได้บันทึกการเปลี่ยนแปลง · ยืนยันได้ถึง {new Date(schemaReview.expiresAt).toLocaleTimeString("th-TH")}</p>}
                  {result.dataDesign.requirement && requirementReview?.index === index && <div role="status">
                    <p>ข้อมูลทดสอบในพื้นที่พัฒนา {requirementReview.data.total} แถว · ค่าว่างหรืออ่านค่าไม่ได้ {requirementReview.data.invalid} แถว</p>
                    {!!requirementReview.data.sampleIds.length && <div>
                      <p>แถวตัวอย่างที่ต้องตรวจใน <code>{result.dataDesign.requirement.table}.{result.dataDesign.requirement.column}</code></p>
                      <div className="ai-actions">{requirementReview.data.sampleIds.map(id => <a className="button" key={id}
                        href={`/t/${encodeURIComponent(result.dataDesign!.requirement!.table)}?row=${encodeURIComponent(id)}&edit=1`}
                        target="_blank" rel="noopener noreferrer">ตรวจแถว {id}</a>)}</div>
                      <p className="hint">หลังแก้ข้อมูลแล้ว กดตรวจข้อมูลอีกครั้งเพื่ออัปเดตผลตรวจ</p>
                    </div>}
                    {requirementReview.data.conditional && <p>สูตร Required_If ยังมีผลตามเงื่อนไขเดิม</p>}
                    <p>ข้อมูลเวอร์ชันจริงจะตรวจแยกในขั้นตอนซ้อมเผยแพร่</p>
                  </div>}
                  <div className="ai-actions">
                    <button type="button" className="button" disabled={designSaving} onClick={() => setDesignConfirm(null)}>ยกเลิก</button>
                    {result.dataDesign.requirement && <button type="button" className="button" disabled={designSaving}
                      onClick={() => void applyDesign(result, index, true)}>ตรวจข้อมูล</button>}
                    {!result.dataDesign.requirement && designError && <button type="button" className="button" disabled={designSaving}
                      onClick={() => void applyDesign(result,index,true)}>ตรวจแผนใหม่</button>}
                    {reviewFor(result,index)?.planId && authorizedPlan !== reviewFor(result,index)?.planId &&
                      <button type="button" className="button" disabled={designSaving} onClick={() => void approvePlan(result,index)}>อนุมัติแผน</button>}
                    {authorizedPlan && authorizedPlan === reviewFor(result,index)?.planId && <span role="status">อนุมัติแล้ว · รอนำไปใช้</span>}
                    <button type="button" className="button" disabled={designSaving || !authorizedPlan ||
                      authorizedPlan !== reviewFor(result,index)?.planId} onClick={() => void applyDesign(result, index)}>
                      {designSaving ? "กำลังนำแผนไปใช้…" : "ยืนยันและนำไปใช้"}
                    </button>
                  </div>
                </> : <button type="button" className="button" disabled={designSaving} onClick={() => {
                  setDesignError(""); setRequirementReview(null); setSchemaReview(null); setDesignConfirm(index);
                  if (!result.dataDesign?.requirement) void applyDesign(result,index,true);
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
          placeholder={turns.length ? "ถามต่อ หรือบอกสิ่งที่ต้องการให้ทำ…" : "เล่าระบบที่อยากสร้าง หรือบอกงานที่ต้องการให้ช่วย…"} onChange={event => setMessage(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            void send();
          }}/>
        <button type="button" className="primary" onClick={() => send()} disabled={pending || !message.trim()}>ส่ง</button>
      </div>
      <div className="ai-chat-focus" role="group" aria-label="เน้นการคุย">
        {[
          ["auto","✦ อัตโนมัติ"],["requirements","วิเคราะห์ความต้องการ"],
          ["design","ออกแบบระบบ"],["technical","เชิงเทคนิค"],
        ].map(([value,label])=><button type="button" key={value} aria-pressed={focus===value}
          disabled={pending} onClick={()=>setFocus(value)}>{label}</button>)}
      </div>
      <div className="ai-actions">
        <small className="hint">{isAiSchemaRequest(message)
          ? "ส่งคำสั่งนี้เพื่อสร้างแผนโครงสร้าง ระบบจะรอให้คุณตรวจและยืนยัน"
          : "Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่ · เลี่ยงการใส่ข้อมูลลับ"}</small>
      </div>
    </div>
    </div><aside className={`ai-chat-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="เครื่องมือบทสนทนา">
      <div className="ai-sidebar-heading"><strong>Copilot</strong>
      <button type="button" className="ai-sidebar-toggle" aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? "ขยายแถบด้านข้าง" : "ย่อแถบด้านข้าง"} title={sidebarCollapsed ? "ขยายแถบด้านข้าง" : "ย่อแถบด้านข้าง"}
        onClick={()=>setSidebarCollapsed(value=>!value)}><Icon name="menu"/></button></div>
        {workspace !== "live" && <>
          <button type="button" aria-label="ประวัติแผน" title="ประวัติแผน" disabled={historyLoading} onClick={() => {setSidebarCollapsed(false);void loadPlanHistory();}}><Icon name="folder"/><span>ประวัติแผน</span></button>
        </>}
        <button type="button" aria-label="เริ่มแชตใหม่" title="เริ่มแชตใหม่" disabled={pending || designSaving || historyLoading} onClick={() => { setTurns([]); setMessage(""); setDesignConfirm(null); input.current?.focus(); }}><Icon name="plus"/><span>เริ่มแชตใหม่</span></button>
      {planHistory && <section className="ai-answer" aria-label="ประวัติแผน Copilot">
        <div className="ai-actions">
          <strong>ประวัติแผน Copilot</strong>
          <button type="button" disabled={historyLoading} onClick={() => void loadPlanHistory()}>รีเฟรชประวัติ</button>
          <button type="button" onClick={() => {setPlanHistory(null);setUndoConfirm(null);setUndoError("");}}>ปิดประวัติ</button>
        </div>
        {"error" in planHistory ? <p role="alert">{planHistory.error}</p> : planHistory.plans.length
          ? <ul className="ai-sidebar-plans">{planHistory.plans.map(plan => <li key={plan.planId}>
            {plan.kind === "required" ? "บังคับกรอก" : "โครงสร้าง"} · {plan.cancelledAt ? "ยกเลิกแล้ว" : plan.revertedAt ? "ย้อนกลับแล้ว" : plan.approvedAt ? "ยืนยันและบันทึกแล้ว" : plan.expiresAt <= Date.now() ? "หมดอายุ" : plan.authorizedAt ? "อนุมัติแล้ว · รอนำไปใช้" : "รออนุมัติ"} · {new Date(plan.cancelledAt ?? plan.revertedAt ?? plan.approvedAt ?? plan.authorizedAt ?? plan.reviewedAt).toLocaleString("th-TH")}
            <br/><code>{plan.receiptId ?? plan.planId}</code>
            {!!plan.hasPayload && !!plan.authorizedAt && !plan.approvedAt && plan.expiresAt > Date.now() &&
              <button type="button" disabled={pending || designSaving || historyLoading} onClick={() => void resumePlan(plan.planId)}>เปิดแผนต่อ</button>}
            {plan.canUndo && (undoConfirm === plan.planId ? <div className="ai-actions">
              <span>คืนการตั้งค่าที่แผนนี้แก้ในพื้นที่พัฒนา</span>
              <button type="button" disabled={historyLoading} onClick={() => setUndoConfirm(null)}>ยกเลิก</button>
              <button type="button" disabled={historyLoading} onClick={() => void updatePlanHistory(plan.planId,"undo")}>ยืนยันย้อนแผน</button>
            </div> : <button type="button" disabled={historyLoading} onClick={() => {setUndoError("");setUndoConfirm(plan.planId);}}>ย้อนแผน</button>)}
            {!plan.cancelledAt && !plan.approvedAt && plan.expiresAt > Date.now() && (undoConfirm === plan.planId ? <div className="ai-actions">
              <span>ยกเลิกผลตรวจและสิทธิ์นำแผนนี้ไปใช้</span>
              <button type="button" disabled={historyLoading} onClick={() => setUndoConfirm(null)}>เก็บแผนไว้</button>
              <button type="button" disabled={historyLoading} onClick={() => void updatePlanHistory(plan.planId,"cancel")}>ยืนยันยกเลิกแผน</button>
            </div> : <button type="button" disabled={historyLoading} onClick={() => {setUndoError("");setUndoConfirm(plan.planId);}}>ยกเลิกแผน</button>)}
          </li>)}</ul> : <p>ยังไม่มีประวัติแผนในพื้นที่นี้</p>}
      </section>}
      {undoError && <p role="alert" className="err">{undoError}</p>}
    </aside>
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
