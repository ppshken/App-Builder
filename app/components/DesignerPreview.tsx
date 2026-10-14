"use client";
import SearchSelect from "@/app/components/SearchSelect";
import { useEffect, useMemo, useRef, useState } from "react";
import type {RowAction} from "@/lib/automation";
import { AppView } from "@/lib/views";
import Icon, { IconName } from "./Icon";
export default function DesignerPreview({ actionDraft=null,draft, dirty, views, selected, revision, onSelect, onOpenSettings }: { actionDraft?:RowAction|null; draft:AppView|null; dirty:boolean; views: AppView[]; selected: string; revision: number; onOpenSettings: (name: string) => void; onSelect: (name: string) => void }) {
  const [device, setDevice] = useState("mobile"), [refresh, setRefresh] = useState(0), [size, setSize] = useState({ width: 340, height: 550 }), [active, setActive] = useState(selected);
  const [draftError,setDraftError]=useState(""),[draftHidden,setDraftHidden]=useState(false);
  const actionSnapshot=useRef<RowAction|null>(actionDraft);actionSnapshot.current=actionDraft;
  const sendAction=()=>frame.current?.contentWindow?.postMessage({type:"nocode:action-preview-draft",action:actionSnapshot.current},location.origin);
  useEffect(()=>{sendAction();},[actionDraft]);
  const snapshot=useRef<any>(null);
  const sendDraft=()=>frame.current?.contentWindow?.postMessage({type:"nocode:preview-draft",...snapshot.current},location.origin);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(async()=>{if(!dirty||!draft){snapshot.current={view:null};setDraftError("");setDraftHidden(false);sendDraft();return;}try{const r=await fetch("/api/views/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft),signal:controller.signal}),j=await r.json();if(!r.ok)throw Error(j.error);snapshot.current=j;setDraftError("");setDraftHidden(!j.visible);sendDraft();}catch(e){if(!controller.signal.aborted)setDraftError((e as Error).message);}},250);return()=>{clearTimeout(timer);controller.abort();};},[draft,dirty]);
  const [activeRow, setActiveRow] = useState<number | undefined>();
  const [reload, setReload] = useState<{ selected: string; revision: number; url: string } | null>(null);
  const area = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { const el = area.current; if (!el) return; const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect, next = { width: Math.floor(rect.width), height: Math.floor(rect.height) }; setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next); }); observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => { setActive(selected); setActiveRow(undefined); }, [selected, revision]);
  useEffect(() => {
    const receive = (event: MessageEvent) => { if(event.origin===location.origin&&event.source===frame.current?.contentWindow&&(event.data?.type==="nocode:preview-ready"||event.data?.type==="nocode:action-preview-ready")){sendDraft();sendAction();return;} if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === "nocode:preview-view" && (views.some(v => v.name === event.data.name)||draft?.name===event.data.name)) { setActive(event.data.name); setActiveRow(Number.isSafeInteger(event.data.row) && event.data.row > 0 ? event.data.row : undefined); } };
    window.addEventListener("message", receive); return () => window.removeEventListener("message", receive);
  }, [views,draft?.name]);
  const rawWidth = device === "mobile" ? 390 : device === "tablet" ? 960 : Math.max(1024,size.width - 12);
  const scale = Math.min(1, Math.max(0.1, (size.width - 12) / rawWidth)), rawHeight = Math.max(100, Math.floor((size.height - 12) / scale)), url = `/run?view=${encodeURIComponent(selected)}`;
  const activeUrl = `/run?view=${encodeURIComponent(active)}${activeRow ? `&row=${activeRow}` : ""}`;
  const source = reload?.selected === selected && reload?.revision === revision ? reload.url : url;
  // Selecting a View navigates inside the existing app; only refresh/save remounts it.
  const sourceUrl = useMemo(()=>source,[revision,refresh,!!selected]);
  useEffect(()=>{frame.current?.contentWindow?.postMessage({type:"nocode:preview-navigate",name:selected},location.origin);},[selected]);
  const previewViews=draft&&dirty?[...views.filter(v=>v.name!==draft.name),draft]:views;
  const current = previewViews.find(v => v.name === active);
  return <aside className={`designer-preview preview-device-${device} ${device === "desktop" ? "preview-fullscreen" : ""}`} aria-label="ตัวอย่างแอป">
    <div className="designer-preview-toolbar"><div className="device-switch" role="group" aria-label="ขนาดหน้าจอ Preview">{([["mobile", "มือถือ", "phone"], ["tablet", "แท็บเล็ต", "tablet"], ["desktop", "คอมพิวเตอร์", "monitor"]] as [string, string, IconName][]).map(([value, label, icon]) => <button key={value} className="icon-button" title={label} aria-label={label} aria-pressed={device === value} onClick={() => setDevice(value)}><Icon name={icon}/></button>)}</div><button className="icon-button" title="โหลดตัวอย่างใหม่" aria-label="โหลดตัวอย่างใหม่" onClick={() => { setReload({ selected, revision, url: activeUrl }); setRefresh(n => n + 1); }}><Icon name="refresh"/></button><a className="icon-button button" href={activeUrl} target="_blank" rel="noreferrer" aria-label="เปิดแอปในแท็บใหม่" title="เปิดแอปในแท็บใหม่"><Icon name="external"/></a></div>
    <div className="designer-preview-content"><div className="field preview-view-picker"><label htmlFor="designer-preview-view">View ที่เปิดใน Preview</label><SearchSelect id="designer-preview-view" value={active} onChange={e => { setReload(null); onSelect(e.target.value); }} disabled={!previewViews.length}>{previewViews.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}</SearchSelect></div>
      <div className="designer-preview-stage" ref={area}>{(selected || draft&&dirty) ? <div className={`designer-preview-frame ${device}`} style={{ width: rawWidth * scale + 12, height: rawHeight * scale + 12 }}><iframe allow="geolocation" ref={frame} key={`${revision}-${refresh}`} title="ตัวอย่างแอป" src={sourceUrl} style={{ width: rawWidth, height: rawHeight, transform: `scale(${scale})` }}/></div> : <div className="preview-placeholder"><Icon name="phone" width="40" height="40"/><p>สร้าง View เพื่อดูตัวอย่างแอป</p></div>}</div>
      {draftError&&<p className="err" role="alert">ยังแสดงการตั้งค่าล่าสุดไม่ได้: {draftError}</p>}{draftHidden&&<p className="hint">View ที่แก้ไขถูกซ่อนตาม Show_If</p>}<p className="designer-preview-context">View: {current ? <button className="preview-settings-link" title="เปิดการตั้งค่าของ View นี้" aria-label={`ตั้งค่า View ที่แสดง ${current.label}`} onClick={() => onOpenSettings(current.name)}>{current.label}<Icon name="settings" width="12" height="12"/></button> : <strong>—</strong>}<span>ตาราง: <strong>{current?.table_name || "—"}</strong></span></p><p className="designer-preview-note">รูปแบบที่แก้ไขแสดงก่อนบันทึก · Preview ใช้ข้อมูลจริง การเพิ่ม แก้ไข หรือลบข้อมูลจะบันทึกลงแอป</p>
    </div>
  </aside>;
}
