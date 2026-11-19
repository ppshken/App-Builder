"use client";
import SearchSelect from "@/app/components/SearchSelect";
import { useEffect, useMemo, useRef, useState } from "react";
import { ICON_CATALOG, type IconName } from "@/lib/icons";
import Icon from "./Icon";
import EditorDialog from "./EditorDialog";
import { createPortal } from "react-dom";
export default function IconPicker({ value, onChange, disabled = false, automatic }: { value: string; onChange: (name: IconName | "") => void; disabled?: boolean; automatic?: IconName }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [style,setStyle] = useState(""), [limit,setLimit]=useState(96);
  const expandButton=useRef<HTMLButtonElement>(null),wasExpanded=useRef(false);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{if(wasExpanded.current&&!expanded)expandButton.current?.focus({preventScroll:true});wasExpanded.current=expanded;},[expanded]);
  const closeExpanded=()=>{setExpanded(false);setLimit(96);};
  const selectIcon=(name:IconName|"")=>{onChange(name);if(expanded)closeExpanded();};
  useEffect(()=>{if(disabled){setExpanded(false);setLimit(96);}},[disabled]);
  const grid=useRef<HTMLDivElement>(null);
  const matches = useMemo(()=>{const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);return ICON_CATALOG.filter(i => (!category || i.category === category) && (!style || (i.name.endsWith("-solid") ? "solid" : "outline") === style) && terms.every(term=>`${i.name} ${i.label} ${i.category} ${i.keywords}`.toLowerCase().includes(term)));},[query,category,style]);
  useEffect(()=>{if(grid.current)grid.current.scrollTop=0;},[query,category,style]);
  const chosen = ICON_CATALOG.find(i => i.name === value);
  const controls=<div className={expanded?"icon-picker-expanded":"icon-picker-controls"}>
    <div className="icon-picker-tools"><label><span className="sr-only">ค้นหาไอคอน</span><input type="search" aria-label="ค้นหาไอคอน" disabled={disabled} value={query} onChange={e => {setQuery(e.target.value);setLimit(expanded?384:96);}} placeholder="ค้นหา เช่น รถ, สินค้า, truck"/></label><label><span className="sr-only">หมวดไอคอน</span><SearchSelect aria-label="หมวดไอคอน" disabled={disabled} value={category} onChange={e => {setCategory(e.target.value);setLimit(expanded?384:96);}}><option value="">ทุกหมวด</option>{[...new Set(ICON_CATALOG.map(i => i.category))].map(c => <option key={c}>{c}</option>)}</SearchSelect></label></div>
    <label className="icon-picker-style">รูปแบบไอคอน<SearchSelect aria-label="รูปแบบไอคอน" disabled={disabled} value={style} onChange={e=>{setStyle(e.target.value);setLimit(expanded?384:96);}}><option value="">ทุกแบบ</option><option value="outline">Outline · เส้น</option><option value="solid">Solid · ทึบ</option></SearchSelect></label>
    <div ref={grid} className="icon-picker-grid" role="group" aria-label="เลือกไอคอน">{automatic && <button type="button" disabled={disabled} aria-label="ไอคอนอัตโนมัติ" aria-pressed={!value} onClick={() => selectIcon("")}><Icon name={automatic}/><small>อัตโนมัติ</small></button>}{matches.slice(0,limit).map(i => <button type="button" key={i.name} disabled={disabled} title={`${i.label} · ${i.name}`} aria-label={`ไอคอน ${i.label}${i.name.startsWith('tabler-')?' · '+i.name:''}`} aria-pressed={value === i.name} onClick={() => selectIcon(i.name as IconName)}><Icon name={i.name as IconName}/><small>{i.label}</small></button>)}</div>
    {matches.length>limit&&<button type="button" disabled={disabled} onClick={()=>setLimit(n=>n+(expanded?384:96))}>แสดงไอคอนเพิ่มเติม</button>}
    <small className="hint" aria-live="polite">{matches.length ? `แสดง ${Math.min(limit,matches.length)} จาก ${matches.length} ไอคอน · ค้นหาได้ทั้งไทยและอังกฤษ` : "ไม่พบไอคอน ลองเปลี่ยนคำค้นหรือเลือกทุกหมวด"}</small>
  </div>;
  return <div className="icon-picker"><div className="icon-picker-current"><Icon name={chosen?.name as IconName || automatic || "grid"}/><strong>{chosen?.label || "อัตโนมัติ"}</strong><span className="hint">{ICON_CATALOG.length} ไอคอน</span><button type="button" ref={expandButton} className="icon-button" disabled={disabled} aria-label="ขยายตัวเลือกไอคอนเต็มจอ" title="ขยายเต็มจอ" onClick={()=>{setLimit(384);setExpanded(true);}}><Icon name="expand"/></button></div>
    {!expanded&&controls}
    {expanded&&createPortal(<div onKeyDown={e=>e.stopPropagation()}>
      <EditorDialog title="เลือกไอคอน" subtitle={ICON_CATALOG.length+" ไอคอน · เลือกเพื่อกลับไปยังหน้าตั้งค่า"} onClose={closeExpanded} className="icon-picker-fullscreen" stopCancelPropagation>{controls}</EditorDialog>
    </div>,document.body)}
  </div>;
}
