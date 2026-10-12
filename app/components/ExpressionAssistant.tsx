"use client";
import FormulaEditor from "@/app/components/FormulaEditor";
import {useAuth} from "./AuthProvider";
import SearchSelect from "@/app/components/SearchSelect";
import { useEffect, useRef, useState } from "react";
import { calculateRow, Column, FormulaField, FORMULA_LABELS, formulaErrors, normalizeValue, refTablesOf } from "@/lib/columns";
import { asBoolean, evaluateExpression, references, formatFormula } from "@/lib/expression";
import EditorDialog from "./EditorDialog";
import Icon from "./Icon";
const EXAMPLES: { name: string; formula: string; fields?: FormulaField[] }[] = [
  { name: "วันที่วันนี้", formula: "TODAY()", fields: ["default_expr", "virtual_expr"] },
  { name: "วันและเวลาปัจจุบัน", formula: "NOW()", fields: ["default_expr", "virtual_expr"] },
  { name: "รหัสไม่ซ้ำสำหรับ Key แบบข้อความ", formula: "UNIQUEID()", fields: ["default_expr"] },
  { name: "ชื่อผู้ใช้ปัจจุบัน", formula: "USERNAME()" },
  { name: "รหัสบัญชีผู้ใช้", formula: "USERID()" },
  { name: "แสดงเฉพาะเจ้าของแอป", formula: "ISOWNER()" },
  { name: "ชื่อบทบาทของบัญชี", formula: "USERROLE()" },
  { name: "คีย์บทบาทของบัญชี", formula: "USERROLEKEY()" },
  { name: "ค่าตั้งค่าของผู้ใช้", formula: 'USERSETTINGS("branch")' },
  { name: "อีเมลผู้ใช้ที่เข้าสู่ระบบ", formula: "USEREMAIL()", fields: ["default_expr", "virtual_expr"] },
  { name: "ตรวจว่าไม่ว่าง", formula: "ISNOTBLANK([_THIS])", fields: ["valid_if"] },
  { name: "ตัวเลขตั้งแต่ศูนย์ขึ้นไป", formula: "[_THIS] >= 0", fields: ["valid_if"] },
  { name: "แสดงเสมอ / เงื่อนไขเป็นจริง", formula: "TRUE" }, { name: "เงื่อนไขเป็นเท็จ", formula: "FALSE" },
];
export default function ExpressionAssistant({ column, columns, field, onApply, onClose, contextLabel, tables = [], busy=false, saveError="", applyLabel="ใช้สูตรนี้" }: {
  column: Column; columns: Column[]; field: FormulaField; onApply: (value: string) => void|Promise<void>; busy?:boolean;saveError?:string;applyLabel?:string; onClose: () => void; contextLabel?: string; tables?: { name: string; label: string; columns?: Column[] }[];
}) {
  const [source, setSource] = useState(column[field] || ""), [tab, setTab] = useState("columns"), [samples, setSamples] = useState<Record<string, any>>({});
  const {user,expressionUser}=useAuth();
  const sampleEmail=user?.email || "";
  const [accountChoices,setAccountChoices]=useState<{definitions:{name:string;label:string}[];roles:{name:string;label:string}[]}>({definitions:[],roles:[]});
  useEffect(()=>{const controller=new AbortController();fetch("/api/user-settings",{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(setAccountChoices).catch(()=>{});return()=>controller.abort();},[]);
  const [result, setResult] = useState<{ value?: string; error?: string } | null>(null), input = useRef<HTMLTextAreaElement>(null);
  const candidate = columns.map(c => c.name === column.name ? { ...c, [field]: source } : c);
  const independentError = () => { try { if (!source.trim()) return "กรุณากรอกสูตร"; const names = new Set(["id", ...columns.map(c=>c.name)]); for (const n of references(source)) if (!names.has(n)) return `ไม่พบคอลัมน์ [${n}]`; return ""; } catch(e) { return (e as Error).message; } };
  const error = contextLabel ? independentError() : source.trim() ? formulaErrors(candidate, tables.length ? Object.fromEntries(tables.filter(t => t.columns).map(t => [t.name, t.columns!])) : undefined)[`${column.name}.${field}`] : field === "virtual_expr" ? "ช่องคำนวณต้องมีสูตร" : "";
  const [formatError,setFormatError]=useState("");
  const change = (value: string) => { setSource(value); setResult(null); setFormatError(""); };
  const format=()=>{try{change(formatFormula(source));requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(0,0);});}catch(e){setFormatError("จัดรูปแบบสูตรไม่ได้: "+(e as Error).message);}};
  const insert = (value: string) => {
    const start = input.current?.selectionStart ?? source.length, end = input.current?.selectionEnd ?? source.length;
    change(source.slice(0, start) + value + source.slice(end));
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + value.length, start + value.length); });
  };
  const test = async () => {
    try {
      if (!source.trim()) throw new Error("กรุณากรอกสูตรก่อนทดสอบ");
      if (error) throw new Error(error);
      const r = await fetch("/api/expression-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, columns, userEmail: sampleEmail }) }), data = await r.json(); if (!r.ok) throw new Error(data.error);
      const options = { ...expressionUser, tables: data, userEmail: sampleEmail, refTables: refTablesOf(columns) };
      const { row } = calculateRow(columns, samples, true, new Date(), true, sampleEmail, options);
      const value = evaluateExpression(source, { ...row, _THIS: row[column.name] ?? null }, options);
      if (["show_if", "valid_if", "required_if"].includes(field) && !(field === "valid_if" && ["enum","enumlist","list","ref"].includes(column.type) && Array.isArray(value))) asBoolean(value);
      else if (!["show_if", "valid_if", "required_if"].includes(field)) normalizeValue(column, value);
      setResult({ value: value === null ? "ค่าว่าง" : typeof value === "boolean" ? value ? "TRUE (เป็นจริง)" : "FALSE (เป็นเท็จ)" : Array.isArray(value) ? JSON.stringify(value) : String(value) });
    } catch (e) { setResult({ error: e instanceof Error ? e.message : "ทดสอบสูตรไม่ได้" }); }
  };
  return <EditorDialog title="ตัวช่วยเขียนสูตร" subtitle={contextLabel || `${column.label || column.name} · ${FORMULA_LABELS[field]}`} onClose={onClose} busy={busy} wide
    footer={<><button disabled={busy} onClick={onClose}>ยกเลิก</button><button className="primary" disabled={!!error||busy} onClick={() => onApply(source.trim())}><Icon name="check"/>{busy?"กำลังบันทึก…":applyLabel}</button></>}>
    {saveError&&<p className="error-banner" role="alert">{saveError}</p>}
    <div className="formula-source-heading"><label className="field-label" htmlFor="assistant-source">สูตร</label><button type="button" className="formula-format-button" aria-label="จัดรูปแบบสูตร" title="จัดบรรทัดและเยื้องสูตรให้อ่านง่าย" disabled={busy||!source.trim()} onClick={format}>{"<>"}</button></div>
    <FormulaEditor columns={columns} tables={tables} ref={input} disabled={busy} id="assistant-source" className="formula-source" rows={4} spellCheck={false} autoFocus value={source} placeholder="เช่น [qty] * [price]" aria-invalid={!!error} onChange={e => change(e.target.value)} />
    {formatError&&<p className="err" role="alert">{formatError}</p>}
    <div className={`syntax-status ${error ? "err" : "success"}`} role="status"><Icon name={error ? "close" : "check"}/>{error || (source.trim() ? "รูปแบบสูตรถูกต้อง" : "ยังไม่ได้กำหนดสูตร")}</div>
    <p className="hint">ใช้ชื่อในระบบใน [ ] และใส่ข้อความในเครื่องหมายคำพูด ค่าทดสอบด้านล่างไม่บันทึกลงตาราง</p>
    <div className="assistant-tabs" role="tablist" aria-label="เครื่องมือสูตร">{[["columns", "คอลัมน์"], ["tables", "ตาราง"], ["account", "บัญชีและค่าตั้งค่า"], ["examples", "ตัวอย่าง"], ["test", "ลองคำนวณ"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "columns" && <div className="assistant-section"><p className="hint">กดชื่อคอลัมน์เพื่อแทรกในสูตร</p><div className="chips">{columns.filter(c => c.name && (field !== "virtual_expr" || c.name !== column.name)).map(c => <button key={c.name} className="chip" onClick={() => insert(`[${c.name}]`)}>{c.label || c.name}<code>[{c.name}]</code></button>)}{field === "valid_if" && <button className="chip" onClick={() => insert("[_THIS]")}>ค่าของช่องนี้<code>[_THIS]</code></button>}</div></div>}
    {tab === "tables" && <div className="assistant-section"><p className="hint">ดึงรายการคีย์จากตารางอื่น ระบบแสดง Label ให้เมื่อใช้เป็นตัวเลือก EnumList</p><div className="example-list">{tables.map(t => { const key = t.columns?.find(c => c.is_key)?.name || "id", source = t.name + "[" + key + "]"; return <div key={t.name}><button onClick={() => insert(source)}><span>{t.label}<code>{source}</code></span><Icon name="plus"/></button><button onClick={() => insert("SELECT(" + source + ", TRUE)")}><span>ดึงรายการพร้อมเงื่อนไข<code>{"SELECT(" + source + ", TRUE)"}</code></span><Icon name="plus"/></button></div>; })}</div>{!tables.length && <p className="hint">กรอกชื่อตารางในสูตร เช่น permission[permission_key]</p>}</div>}
    {tab === "account" && <div className="assistant-section"><p className="hint">ข้อมูลบัญชีมาจากผู้ใช้ที่เข้าสู่ระบบจริง USERROLE() คืนชื่อที่แสดง ส่วน USERROLEKEY() คืนคีย์บทบาทที่คงเดิมแม้เปลี่ยนชื่อ</p><div className="chips">{["USEREMAIL()","USERID()","USERNAME()","USERROLE()","USERROLEKEY()","ISOWNER()"].map(f=><button className="chip" key={f} onClick={()=>insert(f)}>{f}</button>)}</div><h3>เงื่อนไขตามบทบาท</h3><div className="example-list">{accountChoices.roles.map(r=><button key={r.name} onClick={()=>change("USERROLEKEY() = "+JSON.stringify(r.name))}><span>{r.label}<code>{"USERROLEKEY() = "+JSON.stringify(r.name)}</code></span><Icon name="plus"/></button>)}</div><h3>ค่าตั้งค่าผู้ใช้</h3><div className="chips">{accountChoices.definitions.map(d=><button className="chip" key={d.name} onClick={()=>insert("USERSETTINGS("+JSON.stringify(d.name)+")")}>{d.label}<code>{"USERSETTINGS("+JSON.stringify(d.name)+")"}</code></button>)}</div>{!accountChoices.definitions.length&&<p className="hint">เจ้าของแอปกำหนดช่องที่ ผู้ใช้และสิทธิ์ → ค่าตั้งค่าผู้ใช้</p>}</div>}
    {tab === "examples" && <div className="assistant-section example-list">{EXAMPLES.filter(e => !e.fields || e.fields.includes(field)).map(e => <button key={e.name} onClick={() => change(e.formula)}><span>{e.name}<code>{e.formula}</code></span><Icon name="plus"/></button>)}<p className="hint">ใช้ IF, AND, OR, NOT, CONCATENATE และฟังก์ชันวันที่ได้ ดึงรายการด้วย table[key] หรือ SELECT(table[key], เงื่อนไข) เงื่อนไขใน SELECT ใช้คอลัมน์ของตารางนั้น อ้างแถวในฟอร์มด้วย [_THISROW].[คอลัมน์] และดึงค่าจาก Ref ด้วย [product].[product_price]</p></div>}
    {tab === "test" && <div className="assistant-section"><div className="field"><label htmlFor="sample-email">อีเมลผู้ใช้ปัจจุบัน</label><input id="sample-email" type="email" value={sampleEmail} readOnly/></div><div className="column-fields">{columns.filter(c => !c.is_virtual).map(c => <div className="field" key={c.name}><label htmlFor={`sample-${c.name}`}>{c.label || c.name}</label>{c.type === "enumlist" ? <fieldset className="choice-list" aria-label={c.label}>{(c.options || "").split(",").filter(Boolean).map(o => <label key={o}><input type="checkbox" checked={(samples[c.name] || []).includes(o)} onChange={e => { setResult(null); setSamples({ ...samples, [c.name]: e.target.checked ? [...(samples[c.name] || []), o] : (samples[c.name] || []).filter((v: string) => v !== o) }); }}/>{o}</label>)}</fieldset> : c.type === "yesno" ? <SearchSelect id={`sample-${c.name}`} value={samples[c.name] ?? ""} onChange={e => { setResult(null); setSamples({ ...samples, [c.name]: e.target.value }); }}><option value="">ค่าว่าง</option><option value="1">ใช่</option><option value="0">ไม่ใช่</option></SearchSelect> : <input id={`sample-${c.name}`} type={["number", "decimal", "ref"].includes(c.type) ? "number" : c.type === "date" ? "date" : "text"} step="any" value={samples[c.name] ?? ""} onChange={e => { setResult(null); setSamples({ ...samples, [c.name]: e.target.value }); }}/>}</div>)}</div><button onClick={test}><Icon name="formula"/>ทดสอบสูตร</button>{result && <div className={`result-box ${result.error ? "err" : ""}`} role="status">{result.error || <>ผลลัพธ์: <strong>{result.value}</strong></>}</div>}</div>}
  </EditorDialog>;
}
