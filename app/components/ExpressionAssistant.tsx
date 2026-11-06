"use client";
import {booleanLabels} from '@/lib/boolean-labels';

import {suggestedFormulaColumnTypes,formulaColumnTypePatch,formulaTypeCheck,formulaResultTypes,validateFormulaResult,FormulaResultTypeError} from "@/lib/formula-result-type";
import FormulaEditor from "@/app/components/FormulaEditor";
import {useAuth} from "./AuthProvider";
import SearchSelect from "@/app/components/SearchSelect";
import { useEffect, useRef, useState } from "react";
import { calculateRow, Column, FormulaField, FORMULA_LABELS, formulaErrors, refTablesOf } from "@/lib/columns";
import { evaluateExpression, references, formatFormula } from "@/lib/expression";
import EditorDialog from "./EditorDialog";
import Icon from "./Icon";
import {relatedFormulaSources} from "@/lib/formula-related";
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
export default function ExpressionAssistant({ column, columns, field, onApply, onClose, contextLabel, tables = [], busy=false, saveError="", applyLabel="ใช้สูตรนี้", resultType="column",childListContext=false,localOnly=false,validateSource,onChangeType }: {
  localOnly?:boolean;validateSource?:(source:string)=>void;childListContext?:boolean;onChangeType?:(patch:Partial<Column>,source:string)=>void|Promise<void>; column: Column; columns: Column[]; field: FormulaField; resultType?:"column"|"any"; onApply: (value: string) => void|Promise<void>; busy?:boolean;saveError?:string;applyLabel?:string; onClose: () => void; contextLabel?: string; tables?: { name: string; label: string; columns?: Column[] }[];
}) {
  const [childCount,setChildCount]=useState(0);
  const [source, setSource] = useState(column[field] || ""), [tab, setTab] = useState("columns"), [samples, setSamples] = useState<Record<string, any>>({});
  const {user,expressionUser}=useAuth();
  const sampleEmail=user?.email || "";
  const [accountChoices,setAccountChoices]=useState<{definitions:{name:string;label:string}[];roles:{name:string;label:string}[]}>({definitions:[],roles:[]});
  useEffect(()=>{const controller=new AbortController();fetch("/api/user-settings",{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(setAccountChoices).catch(()=>{});return()=>controller.abort();},[]);
  const [result, setResult] = useState<{ value?: string; error?: string; typeError?:boolean; suggestedTypes?:string[] } | null>(null), input = useRef<HTMLTextAreaElement>(null);
  const resultVersion=useRef(0);
  const clearResult=()=>{resultVersion.current++;setResult(null);};
  const [relatedColumns,setRelatedColumns]=useState<Record<string,string>>({});
  const relatedSources=relatedFormulaSources(columns,tables),sampleTable=columns.find(c=>c.table_name)?.table_name;
  const candidate = columns.map(c => c.name === column.name ? { ...c, [field]: source } : c);
  const independentError = () => { try { if (!source.trim()) return "กรุณากรอกสูตร"; validateSource?.(source); const names = new Set(["id", ...(childListContext||field==="valid_if"?["_THIS"]:[]), ...columns.map(c=>c.name)]); for (const n of references(source)) if (!names.has(n)) return `ไม่พบคอลัมน์ [${n}]`; return ""; } catch(e) { return (e as Error).message; } };
  const syntaxError = contextLabel ? independentError() : source.trim() ? formulaErrors(candidate, tables.length ? Object.fromEntries(tables.filter(t => t.columns).map(t => [t.name, t.columns!])) : undefined)[`${column.name}.${field}`] : field === "virtual_expr" ? "ช่องคำนวณต้องมีสูตร" : "";
  const typeCheck=(()=>{if(resultType==="any"||syntaxError||!source.trim())return null;try{return formulaTypeCheck(source,column,field,columns,tables);}catch{return null;}})();
  const [changingType,setChangingType]=useState(false),[changeTypeError,setChangeTypeError]=useState("");
  const suggested=["default_expr","virtual_expr"].includes(field)?typeCheck?.error?suggestedFormulaColumnTypes(source,columns,tables):result?.suggestedTypes||[]:[];
  const error=syntaxError||typeCheck?.error||"";
  const [formatError,setFormatError]=useState("");
  const change = (value: string) => { setSource(value); clearResult(); setFormatError(""); };
  const format=()=>{try{change(formatFormula(source));requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(0,0);});}catch(e){setFormatError("จัดรูปแบบสูตรไม่ได้: "+(e as Error).message);}};
  const insert = (value: string) => {
    const start = input.current?.selectionStart ?? source.length, end = input.current?.selectionEnd ?? source.length;
    change(source.slice(0, start) + value + source.slice(end));
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + value.length, start + value.length); });
  };
  const test = async () => {
    const version=++resultVersion.current;
    try {
      if (!source.trim()) throw new Error("กรุณากรอกสูตรก่อนทดสอบ");
      if (error) throw new Error(error);
      const ownerTable=sampleTable,rawId=samples.id,sampleId=rawId==null||rawId===''?null:Number(rawId);
      if(ownerTable&&sampleId!==null&&(!Number.isSafeInteger(sampleId)||sampleId<1))throw Error('รหัสแถวที่ใช้ทดสอบต้องเป็นจำนวนเต็มบวก');
      const sampleInput=ownerTable?{...samples,id:sampleId}:samples;
      const r = await fetch("/api/expression-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, columns, userEmail: sampleEmail,...(ownerTable?{table:ownerTable,rowId:sampleId}:{}) }) }), data = await r.json(); if (!r.ok) throw new Error(data.error);
      const options = { ...expressionUser, tables: data, tableName:columns.find(c=>c.table_name)?.table_name, userEmail: sampleEmail, refTables: refTablesOf(columns) };
      const { row } = calculateRow(columns, sampleInput, true, new Date(), true, sampleEmail, options);
      const value = evaluateExpression(source, { ...row, _THIS: childListContext?Array.from({length:childCount},(_,i)=>String(i+1)):row[column.name] ?? null }, options);
      const inferred=formulaResultTypes(source,columns,tables);
      if(resultType!=="any")validateFormulaResult(value,column,field,inferred);
      const displayValue=inferred.includes("boolean")&&(value===0||value===1)?Boolean(value):value;
      if(version===resultVersion.current)setResult({ value: displayValue === null ? "ค่าว่าง" : typeof displayValue === "boolean" ? displayValue ? "TRUE (เป็นจริง)" : "FALSE (เป็นเท็จ)" : Array.isArray(displayValue) ? JSON.stringify(displayValue) : String(displayValue) });
    } catch (e) { if(version===resultVersion.current)setResult({ error: e instanceof Error ? e.message : "ทดสอบสูตรไม่ได้",typeError:e instanceof FormulaResultTypeError,suggestedTypes:e instanceof FormulaResultTypeError?e.columnTypes:[] }); }
  };
  return <EditorDialog title="ตัวช่วยเขียนสูตร" subtitle={contextLabel || `${column.label || column.name} · ${FORMULA_LABELS[field]}`} onClose={onClose} busy={busy} wide
    footer={<><button disabled={busy} onClick={onClose}>ยกเลิก</button><button className="primary" disabled={!!error||!!result?.typeError||busy} onClick={() => onApply(source.trim())}><Icon name="check"/>{busy?"กำลังบันทึก…":applyLabel}</button></>}>
    {saveError&&<p className="error-banner" role="alert">{saveError}</p>}
    <div className="formula-source-heading"><label className="field-label" htmlFor="assistant-source">สูตร</label><button type="button" className="formula-format-button" aria-label="จัดรูปแบบสูตร" title="จัดบรรทัดและเยื้องสูตรให้อ่านง่าย" disabled={busy||!source.trim()} onClick={format}>{"<>"}</button></div>
    <FormulaEditor localOnly={localOnly} columns={columns} tables={tables} ref={input} disabled={busy} id="assistant-source" className="formula-source" rows={4} spellCheck={false} autoFocus value={source} placeholder="เช่น [qty] * [price]" aria-invalid={!!error} onChange={e => change(e.target.value)} />
    {formatError&&<p className="err" role="alert">{formatError}</p>}
    <div className={`syntax-status ${error ? "err" : "success"}`} role="status"><Icon name={error ? "close" : "check"}/>{error || (source.trim() ? "รูปแบบสูตรถูกต้อง" : "ยังไม่ได้กำหนดสูตร")}</div>
    {typeCheck&&<div className="formula-result-types"><p><strong>ชนิดผลลัพธ์ที่ต้องการ:</strong> {typeCheck.expected}</p><p><strong>ชนิดผลลัพธ์ของสูตร:</strong> {typeCheck.actual}</p>{typeCheck.actual.includes("ยังระบุไม่ได้")&&<small className="hint">กรุณาลองคำนวณด้วยข้อมูลตัวอย่างเพื่อตรวจชนิดผลลัพธ์</small>}</div>}
    {onChangeType&&suggested.length>0&&<div className="formula-type-change"><button type="button" disabled={busy||changingType} onClick={async()=>{setChangingType(true);setChangeTypeError("");try{await onChangeType(formulaColumnTypePatch(column,suggested[0],field,source.trim()),source.trim());clearResult();}catch(e){setChangeTypeError(e instanceof Error?e.message:"เปลี่ยนชนิดข้อมูลไม่ได้");}finally{setChangingType(false);}}}>{changingType?"กำลังเปลี่ยนชนิดข้อมูล…":"เปลี่ยนชนิดข้อมูลทันที"} → {suggested[0]}</button>{changeTypeError&&<p className="err" role="alert">{changeTypeError}</p>}</div>}
    <p className="hint">ใช้ชื่อในระบบใน [ ] และใส่ข้อความในเครื่องหมายคำพูด ค่าทดสอบด้านล่างไม่บันทึกลงตาราง</p>
    <div className="assistant-tabs" role="tablist" aria-label="เครื่องมือสูตร">{[["columns", "คอลัมน์"], ["related", "Related"], ["tables", "ตาราง"], ["account", "บัญชีและค่าตั้งค่า"], ["examples", "ตัวอย่าง"], ["test", "ลองคำนวณ"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}{value==="related"&&relatedSources.length>0&&<span className="assistant-related-count" aria-hidden="true">{relatedSources.length}</span>}</button>)}</div>
    {tab === "related" && <div className="assistant-section assistant-related" role="tabpanel" aria-label="Related ที่ใช้ในสูตร"><p className="hint">เลือกรายการลูกและคอลัมน์ที่ต้องการ แล้วกดสูตรเพื่อแทรก เฉพาะแถวลูกของแถวแม่ปัจจุบัน</p>{relatedSources.map(related=>{
      const property=relatedColumns[related.alias]||related.columns.find(c=>c.type==="image")?.name||"id",projection=`${related.expression}[${property}]`;
      return <section className="assistant-related-card" key={related.alias} aria-label={related.alias}><header><div><h3>{related.label}</h3><small className="hint">{related.refLabel} ({related.refColumn}) → ตารางนี้</small></div><code>{related.expression}</code></header><label className="assistant-related-column"><span>คอลัมน์จากรายการลูก</span><SearchSelect aria-label={`คอลัมน์จาก ${related.alias}`} value={property} onChange={e=>setRelatedColumns(old=>({...old,[related.alias]:e.target.value}))}>{related.columns.map(c=><option key={c.name} value={c.name}>{c.label||c.name} · {c.name}</option>)}</SearchSelect></label><div className="assistant-related-actions"><button type="button" className="chip" aria-label={`แทรก ${projection}`} onClick={()=>insert(projection)}>รายการค่า<code>{projection}</code></button><button type="button" className="chip" aria-label={`แทรก INDEX(${projection}, 1)`} onClick={()=>insert(`INDEX(${projection}, 1)`)}>ค่าแรก<code>{`INDEX(${projection}, 1)`}</code></button><button type="button" className="chip" aria-label={`แทรก COUNT(${related.expression})`} onClick={()=>insert(`COUNT(${related.expression})`)}>นับรายการ<code>{`COUNT(${related.expression})`}</code></button><button type="button" className="chip" aria-label={`แทรก ${related.expression}`} onClick={()=>insert(related.expression)}>รหัสแถวลูก<code>{related.expression}</code></button></div></section>;
    })}{!relatedSources.length&&<div className="assistant-related-empty"><Icon name="list"/><p>ตารางนี้ยังไม่มี Related ที่ใช้ในสูตร</p><small className="hint">เพิ่มคอลัมน์ Ref ในตารางลูกให้อ้างถึงตารางนี้ แล้วเปิดตัวช่วยอีกครั้ง</small></div>}</div>}
    {tab === "columns" && <div className="assistant-section"><p className="hint">กดชื่อคอลัมน์เพื่อแทรกในสูตร</p><div className="chips">{columns.filter(c => c.name && (field !== "virtual_expr" || c.name !== column.name)).map(c => <button key={c.name} className="chip" onClick={() => insert(`[${c.name}]`)}>{c.label || c.name}<code>[{c.name}]</code></button>)}{(field === "valid_if"||childListContext) && <button className="chip" onClick={() => insert("[_THIS]")}>{childListContext?"รายการลูกทั้งหมด":"ค่าของช่องนี้"}<code>[_THIS]</code></button>}</div></div>}
    {tab === "tables" && <div className="assistant-section"><p className="hint">ดึงรายการคีย์จากตารางอื่น ระบบแสดง Label ให้เมื่อใช้เป็นตัวเลือก EnumList</p><div className="example-list">{tables.map(t => { const key = t.columns?.find(c => c.is_key)?.name || "id", source = t.name + "[" + key + "]"; return <div key={t.name}><button onClick={() => insert(source)}><span>{t.label}<code>{source}</code></span><Icon name="plus"/></button><button onClick={() => insert("SELECT(" + source + ", TRUE)")}><span>ดึงรายการพร้อมเงื่อนไข<code>{"SELECT(" + source + ", TRUE)"}</code></span><Icon name="plus"/></button></div>; })}</div>{!tables.length && <p className="hint">กรอกชื่อตารางในสูตร เช่น permission[permission_key]</p>}</div>}
    {tab === "account" && <div className="assistant-section"><p className="hint">ข้อมูลบัญชีมาจากผู้ใช้ที่เข้าสู่ระบบจริง USERROLE() คืนชื่อที่แสดง ส่วน USERROLEKEY() คืนคีย์บทบาทที่คงเดิมแม้เปลี่ยนชื่อ</p><div className="chips">{["USEREMAIL()","USERID()","USERNAME()","USERROLE()","USERROLEKEY()","ISOWNER()"].map(f=><button className="chip" key={f} onClick={()=>insert(f)}>{f}</button>)}</div><h3>เงื่อนไขตามบทบาท</h3><div className="example-list">{accountChoices.roles.map(r=><button key={r.name} onClick={()=>change("USERROLEKEY() = "+JSON.stringify(r.name))}><span>{r.label}<code>{"USERROLEKEY() = "+JSON.stringify(r.name)}</code></span><Icon name="plus"/></button>)}</div><h3>ค่าตั้งค่าผู้ใช้</h3><div className="chips">{accountChoices.definitions.map(d=><button className="chip" key={d.name} onClick={()=>insert("USERSETTINGS("+JSON.stringify(d.name)+")")}>{d.label}<code>{"USERSETTINGS("+JSON.stringify(d.name)+")"}</code></button>)}</div>{!accountChoices.definitions.length&&<p className="hint">เจ้าของแอปกำหนดช่องที่ ผู้ใช้และสิทธิ์ → ค่าตั้งค่าผู้ใช้</p>}</div>}
    {tab === "examples" && <div className="assistant-section example-list">{EXAMPLES.filter(e => !e.fields || e.fields.includes(field)).map(e => <button key={e.name} onClick={() => change(e.formula)}><span>{e.name}<code>{e.formula}</code></span><Icon name="plus"/></button>)}<p className="hint">ใช้ IF, AND, OR, NOT, CONCATENATE และฟังก์ชันวันที่ได้ ดึงรายการด้วย table[key] หรือ SELECT(table[key], เงื่อนไข) เงื่อนไขใน SELECT ใช้คอลัมน์ของตารางนั้น อ้างแถวในฟอร์มด้วย [_THISROW].[คอลัมน์] และดึงค่าจาก Ref ด้วย [product].[product_price]</p></div>}
    {tab === "test" && <div className="assistant-section">{childListContext&&<label className="field">จำนวนรายการลูกสำหรับทดสอบ<input aria-label="จำนวนรายการลูกสำหรับทดสอบ" type="number" min={0} max={200} value={childCount} onChange={e=>{clearResult();setChildCount(Math.max(0,Math.min(200,Math.trunc(Number(e.target.value)||0))));}}/></label>}<div className="field"><label htmlFor="sample-email">อีเมลผู้ใช้ปัจจุบัน</label><input id="sample-email" type="email" value={sampleEmail} readOnly/></div>{sampleTable&&!columns.some(c=>c.name==="id")&&<div className="field"><label htmlFor="sample-id">ID ของแถวแม่สำหรับทดสอบ</label><input id="sample-id" type="number" min="1" step="1" value={samples.id??""} onChange={e=>{clearResult();setSamples({...samples,id:e.target.value});}}/><small className="hint">เว้นว่างเพื่อทดสอบแถวใหม่ ค่าทดสอบไม่บันทึกลงตาราง</small></div>}<div className="column-fields">{columns.filter(c => !c.is_virtual).map(c => <div className="field" key={c.name}><label htmlFor={`sample-${c.name}`}>{c.label || c.name}</label>{c.type === "enumlist" ? <fieldset className="choice-list" aria-label={c.label}>{(c.options || "").split(",").filter(Boolean).map(o => <label key={o}><input type="checkbox" checked={(samples[c.name] || []).includes(o)} onChange={e => { clearResult(); setSamples({ ...samples, [c.name]: e.target.checked ? [...(samples[c.name] || []), o] : (samples[c.name] || []).filter((v: string) => v !== o) }); }}/>{o}</label>)}</fieldset> : c.type === "yesno" ? <SearchSelect id={`sample-${c.name}`} value={samples[c.name] ?? ""} onChange={e => { clearResult(); setSamples({ ...samples, [c.name]: e.target.value }); }}><option value="">ค่าว่าง</option><option value="1">{booleanLabels(c).true}</option><option value="0">{booleanLabels(c).false}</option></SearchSelect> : <input id={`sample-${c.name}`} type={["number", "decimal", "ref"].includes(c.type) ? "number" : c.type === "date" ? "date" : "text"} step="any" value={samples[c.name] ?? ""} onChange={e => { clearResult(); setSamples({ ...samples, [c.name]: e.target.value }); }}/>}</div>)}</div><button onClick={test}><Icon name="formula"/>ทดสอบสูตร</button>{result && <div className={`result-box ${result.error ? "err" : ""}`} role="status">{result.error || <>ผลลัพธ์: <strong>{result.value}</strong></>}</div>}</div>}
  </EditorDialog>;
}
