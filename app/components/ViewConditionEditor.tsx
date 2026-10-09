"use client";
import FormulaEditor from "@/app/components/FormulaEditor";
import {useAuth} from "./AuthProvider";
import { useState } from "react";
import type { Column } from "@/lib/columns";
import { validateViewCondition, viewIsVisible } from "@/lib/view-visibility";
import Icon from "./Icon";
export default function ViewConditionEditor({ value, tables, disabled, onChange }: { value: string; tables: {name:string;label:string;columns:Column[]}[]; disabled: boolean; onChange:(source:string)=>void }) {
  const {user,expressionUser}=useAuth();
  const [result, setResult] = useState(""), [testing, setTesting] = useState(false);
  let error = ""; try { validateViewCondition(value, Object.fromEntries(tables.map(t => [t.name,t.columns]))); } catch(e) { error = (e as Error).message; }
  const change = (s:string) => { setResult(""); onChange(s); };
  async function test() { setTesting(true); setResult(""); try {
    const r = await fetch("/api/expression-data", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:value || "TRUE",columns:[]})}), data = await r.json(); if (!r.ok) throw new Error(data.error);
    setResult(viewIsVisible(value,{...expressionUser,tables:data,userEmail:user?.email || ""}) ? "ผลทดสอบ: TRUE · แสดง View" : "ผลทดสอบ: FALSE · ซ่อน View");
  } catch(e) { setResult((e as Error).message); } finally { setTesting(false); } }
  return <div className="view-condition-editor"><label className="sr-only" htmlFor="view-show-if">Show_If ของ View</label><FormulaEditor id="view-show-if" rows={3} maxLength={10000} spellCheck={false} value={value} disabled={disabled} aria-invalid={!!error} aria-describedby="view-show-if-help" placeholder={'เช่น COUNT(SELECT(orders[id], [status] = "รอ")) > 0'} onChange={e => change(e.target.value)}/><small className={error ? "err" : "hint"} aria-live="polite">{error || (value.trim() ? "รูปแบบสูตรถูกต้อง · ทดสอบเพื่อดูผลจากข้อมูลปัจจุบัน" : "ยังไม่กำหนดเงื่อนไข · แสดงเสมอ")}</small><p id="view-show-if-help" className="hint">View ไม่มีแถวปัจจุบัน ใช้สูตรข้ามตารางหรือวันที่ได้ เงื่อนไขนี้ใช้ซ่อนหน้าจอ ไม่ใช่การกำหนดสิทธิ์เข้าถึงข้อมูล</p><div className="row"><button type="button" disabled={disabled || testing || !!error} onClick={test}><Icon name="formula"/>{testing ? "กำลังทดสอบ…" : "ทดสอบ Show_If"}</button><button type="button" disabled={disabled} onClick={() => change("TRUE")}>แสดงเสมอ</button><button type="button" disabled={disabled} onClick={() => change("FALSE")}>ซ่อนเสมอ</button></div><details><summary>ตัวอย่างสูตร</summary><div className="example-list"><button type="button" disabled={disabled} onClick={()=>change("ISOWNER()")}>แสดงเฉพาะเจ้าของแอป<code>ISOWNER()</code></button><button type="button" disabled={disabled} onClick={()=>change("USERROLEKEY() = "+JSON.stringify(expressionUser.userRoleKey||""))}>แสดงเฉพาะบทบาทของบัญชีปัจจุบัน<code>{"USERROLEKEY() = "+JSON.stringify(expressionUser.userRoleKey||"")}</code></button><button type="button" disabled={disabled} onClick={() => change("DAY(TODAY()) <= 15")}>แสดงในครึ่งแรกของเดือน<code>DAY(TODAY()) &lt;= 15</code></button>{tables.map(t => <button type="button" disabled={disabled} key={t.name} onClick={() => change(`COUNT(${t.name}[id]) > 0`)}>แสดงเมื่อ {t.label} มีข้อมูล<code>COUNT({t.name}[id]) &gt; 0</code></button>)}</div></details>{result && <p className="result-box" role="status">{result}</p>}</div>;
}
