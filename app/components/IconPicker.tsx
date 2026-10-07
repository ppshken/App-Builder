"use client";
import SearchSelect from "@/app/components/SearchSelect";
import { useState } from "react";
import { ICON_CATALOG, type IconName } from "@/lib/icons";
import Icon from "./Icon";
export default function IconPicker({ value, onChange, disabled = false, automatic }: { value: string; onChange: (name: IconName | "") => void; disabled?: boolean; automatic?: IconName }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState("");
  const matches = ICON_CATALOG.filter(i => (!category || i.category === category) && `${i.name} ${i.label} ${i.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const chosen = ICON_CATALOG.find(i => i.name === value);
  return <div className="icon-picker"><div className="icon-picker-current"><Icon name={chosen?.name as IconName || automatic || "grid"}/><strong>{chosen?.label || "อัตโนมัติ"}</strong><span className="hint">{ICON_CATALOG.length} ไอคอน</span></div>
    <div className="icon-picker-tools"><label><span className="sr-only">ค้นหาไอคอน</span><input type="search" aria-label="ค้นหาไอคอน" disabled={disabled} value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหา เช่น รถ, สินค้า, truck"/></label><label><span className="sr-only">หมวดไอคอน</span><SearchSelect aria-label="หมวดไอคอน" disabled={disabled} value={category} onChange={e => setCategory(e.target.value)}><option value="">ทุกหมวด</option>{[...new Set(ICON_CATALOG.map(i => i.category))].map(c => <option key={c}>{c}</option>)}</SearchSelect></label></div>
    <div className="icon-picker-grid" role="group" aria-label="เลือกไอคอน">{automatic && <button type="button" disabled={disabled} aria-label="ไอคอนอัตโนมัติ" aria-pressed={!value} onClick={() => onChange("")}><Icon name={automatic}/><small>อัตโนมัติ</small></button>}{matches.map(i => <button type="button" key={i.name} disabled={disabled} title={`${i.label} · ${i.name}`} aria-label={`ไอคอน ${i.label}`} aria-pressed={value === i.name} onClick={() => onChange(i.name as IconName)}><Icon name={i.name as IconName}/><small>{i.label}</small></button>)}</div>
    <small className="hint" aria-live="polite">{matches.length ? `พบ ${matches.length} ไอคอน · ค้นหาได้ทั้งไทยและอังกฤษ` : "ไม่พบไอคอน ลองเปลี่ยนคำค้นหรือเลือกทุกหมวด"}</small>
  </div>;
}
