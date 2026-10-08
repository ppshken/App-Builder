"use client";
import SearchSelect from "@/app/components/SearchSelect";
import AppLoading from "@/app/components/AppLoading";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ColumnEditor, { TYPES } from "./components/ColumnEditor";
import EditorDialog from "./components/EditorDialog";
import Icon from "./components/Icon";
import { metadataChanged } from "./components/AppShell";
import { blankColumn, Column, formulaErrors, IDENT, UNIQUE_TYPES } from "@/lib/columns";
type Table = { name: string; label: string; columns: Column[] };
export default function Home() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]), [loaded, setLoaded] = useState(false), [query, setQuery] = useState("");
  const [restored,setRestored]=useState(false);
  const [creating, setCreating] = useState(false), [name, setName] = useState(""), [label, setLabel] = useState("");
  const [cols, setCols] = useState<Column[]>([]), [active, setActive] = useState<number | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setRestored(new URL(location.href).searchParams.get("restored")==="1"); fetch("/api/tables").then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setTables(j); }).catch(e => setErr(e.message || "โหลดตารางไม่ได้")).finally(() => setLoaded(true)); }, []);
  const start = () => {
    let i = 1; while (tables.some(t => t.name === `table_${i}`)) i++;
    setName(`table_${i}`); setLabel(""); setCols([{ ...blankColumn(), name: "name", label: "ชื่อ", is_label:true }]); setErr(""); setCreating(true);
  };
  useEffect(()=>{if(!loaded)return;const create=()=>start();window.addEventListener("nocode:new-table",create);const url=new URL(location.href);if(url.searchParams.get("new")==="1"){start();url.searchParams.delete("new");history.replaceState({},"",url);}return()=>window.removeEventListener("nocode:new-table",create);},[loaded,tables]);
  const upd = (i: number, patch: Partial<Column>) => setCols(old => old.map((c, j) => j === i ? { ...c, ...patch } : { ...c, ...(patch.is_key ? { is_key: false } : {}), ...(patch.is_label && (c.type==="image")===((patch.type||old[i].type)==="image") ? { is_label: false } : {}) }));
  const addColumn = () => { let i = cols.length + 1; while (cols.some(c => c.name === `column_${i}`)) i++; setCols([...cols, { ...blankColumn(), name: `column_${i}`, label: "" }]); };
  async function save() {
    setErr("");
    if (!label.trim()) return setErr("กรุณาตั้งชื่อตาราง เช่น ลูกค้า หรือ รายการขาย");
    const missing = cols.findIndex(c => !c.label.trim());
    if (missing >= 0) return setErr(`กรุณาตั้งชื่อคอลัมน์ที่ ${missing + 1}`);
    const first = Object.values(formulaErrors(cols))[0]; if (first) return setErr(first);
    setBusy(true);
    try {
      const r = await fetch("/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, label, columns: cols }) }), j = await r.json();
      if (!r.ok) throw new Error(j.error); metadataChanged(); router.push(`/t/${name}/edit`);
    } catch (e) { setErr(e instanceof Error ? e.message : "สร้างตารางไม่ได้ กรุณาลองใหม่"); setBusy(false); }
  }
  const filtered = tables.filter(t => `${t.label} ${t.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <div className="page-heading"><div><div className="eyebrow">ข้อมูลมาก่อน แอปตามมา</div><h1>ตารางของฉัน</h1><p>เลือกตารางเพื่อดูข้อมูล หรือเริ่มสร้างตารางใหม่</p></div><button className="primary" onClick={start}><Icon name="plus"/>สร้างตารางใหม่</button></div>
    {restored&&<div className="success-banner" role="status">กู้คืนข้อมูลเรียบร้อยแล้ว ระบบสำรองข้อมูลก่อนกู้คืนไว้ในหน้า สำรองและกู้คืนข้อมูล</div>}
    <div className="overview-stats"><div><Icon name="table"/><span><strong>{tables.length}</strong> ตารางข้อมูล</span></div><div><Icon name="database"/><span>เก็บข้อมูลบนเครื่องของคุณ</span></div></div>
    <div className="content-toolbar"><div className="search-box"><Icon name="search"/><input aria-label="ค้นหาตาราง" placeholder="ค้นหาตาราง…" value={query} onChange={e => setQuery(e.target.value)}/></div><span className="hint">{filtered.length} ตาราง</span></div>
    {err && !creating && <div className="error-banner" role="alert">{err}</div>}
    {!loaded ? <AppLoading/> : !filtered.length ? <div className="panel empty-state"><span className="empty-icon"><Icon name="table" width="32" height="32"/></span><h2>{query ? "ไม่พบตารางที่ค้นหา" : "เริ่มจากตารางแรกของคุณ"}</h2><p>{query ? "ลองค้นหาด้วยชื่ออื่น" : "เช่น ลูกค้า สินค้า หรือรายการขาย ระบบจะสร้างหน้าข้อมูลและฟอร์มให้เอง"}</p>{!query && <button className="primary" onClick={start}><Icon name="plus"/>สร้างตารางแรก</button>}</div> : <div className="table-cards">{filtered.map((t, i) => <article className="table-card" key={t.name}><Link href={`/t/${t.name}`} className="table-card-main"><span className={`table-avatar color-${i % 4}`}><Icon name="table" width="26" height="26"/></span><h2>{t.label}</h2><p>{t.columns.length} คอลัมน์{t.columns.some(c => c.is_virtual) ? ` · ${t.columns.filter(c => c.is_virtual).length} ช่องคำนวณ` : ""}</p><span className="card-open">เปิดข้อมูล<Icon name="chevron" width="16" height="16"/></span></Link><footer><span className="hint">{t.name}</span><Link href={`/t/${t.name}/edit`}><Icon name="settings" width="16" height="16"/>ตั้งค่าคอลัมน์</Link></footer></article>)}</div>}
    {creating && <EditorDialog title="สร้างตารางใหม่" subtitle="ตั้งชื่อและเลือกคอลัมน์ที่ต้องการ เริ่มน้อย ๆ แล้วเพิ่มภายหลังได้" busy={busy} onClose={() => { setCreating(false); setActive(null); }} wide className="create-table-dialog" footer={<><button disabled={busy} onClick={() => setCreating(false)}>ยกเลิก</button><button className="primary" disabled={busy} onClick={save}><Icon name="check"/>{busy ? "กำลังสร้าง…" : "สร้างตาราง"}</button></>}>
      <div className="field"><label htmlFor="table-label">ชื่อที่แสดงของตาราง</label><input id="table-label" autoFocus disabled={busy} placeholder="เช่น ลูกค้า" value={label} onChange={e => setLabel(e.target.value)}/></div>
      <div className="field"><label htmlFor="table-name">ชื่อในระบบของตาราง</label><input id="table-name" disabled={busy} value={name} onChange={e => setName(e.target.value)}/><small className="hint">ระบบตั้งชื่อให้อัตโนมัติ เปลี่ยนได้หากต้องการใช้อ้างอิง</small></div>
      <h3 className="section-title">คอลัมน์ในตาราง</h3><p className="hint">ระบบสร้าง id เป็น Key อัตโนมัติ · Label เลือกข้อความได้ 1 ช่อง และรูปภาพได้ 1 ช่อง · Edit อนุญาตให้กรอกและแก้ไขข้อมูล</p>
      <div className="quick-columns">{cols.map((c, i) => <div className="quick-column" role="group" aria-label={`คอลัมน์ที่ ${i + 1}`} key={i}><span className="row-index">{i + 1}</span><input aria-label={`ชื่อคอลัมน์ที่ ${i + 1}`} disabled={busy} placeholder="ชื่อคอลัมน์" value={c.label} onChange={e => { const value = e.target.value; upd(i, { label: value, ...(IDENT.test(value) && value !== "id" && !cols.some((other, j) => j !== i && other.name === value) ? { name: value } : {}) }); }}/><SearchSelect aria-label={`ชนิดคอลัมน์ที่ ${i + 1}`} disabled={busy} value={c.type} onChange={e => { upd(i, { type: e.target.value, gps_auto:false, max_length:["text","longtext"].includes(e.target.value)?c.max_length??0:0, ...(!UNIQUE_TYPES.includes(e.target.value)?{is_unique:false}:{}), ...(!["text", "longtext", "number", "decimal", "enum"].includes(e.target.value) ? { is_key: false } : {}), ...(["ref", "enumlist", "list"].includes(e.target.value) ? { is_label: false } : {is_label:!!c.is_label}) }); if (["enum", "enumlist", "list", "ref"].includes(e.target.value)) setActive(i); }}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SearchSelect><div className="quick-column-identity"><label><input type="checkbox" aria-label={`Label คอลัมน์ที่ ${i + 1}`} disabled={busy || ["ref","enumlist","list"].includes(c.type)} checked={!!c.is_label} onChange={e => upd(i, { is_label:e.target.checked })}/>Label</label><label><input type="checkbox" aria-label={`Edit คอลัมน์ที่ ${i + 1}`} disabled={busy || !!c.is_virtual} checked={!c.is_virtual && c.is_editable!==false && c.is_editable!==0} onChange={e => upd(i, { is_editable:e.target.checked })}/>Edit</label><label><input type="checkbox" aria-label={`จำเป็น คอลัมน์ที่ ${i + 1}`} disabled={busy || !!c.is_virtual || !!c.is_key} checked={!!c.required || !!c.is_key} onChange={e => upd(i, { required: e.target.checked })}/>จำเป็น</label><label><input type="checkbox" aria-label={`ห้ามซ้ำ คอลัมน์ที่ ${i + 1}`} disabled={busy || !!c.is_virtual || !UNIQUE_TYPES.includes(c.type)} checked={!!c.is_unique} onChange={e => upd(i, { is_unique:e.target.checked })}/>ห้ามซ้ำ</label></div><button className="icon-button quick-column-config" disabled={busy} aria-label={`ตั้งค่าคอลัมน์ที่ ${i + 1}`} onClick={() => setActive(i)}><Icon name="settings"/></button><button className="icon-button quick-column-remove" disabled={busy || cols.length === 1} aria-label={`ลบคอลัมน์ที่ ${i + 1}`} onClick={() => setCols(cols.filter((_, j) => j !== i))}><Icon name="close"/></button></div>)}</div>
      <button className="text-button" disabled={busy} onClick={addColumn}><Icon name="plus"/>เพิ่มคอลัมน์</button>
      
      <p className="backup-note"><Icon name="database" width="16" height="16"/>ก่อนเปลี่ยนโครงสร้าง กรุณาปิดแอปและสำรอง data.db</p>{err && <div className="error-banner" role="alert">{err}</div>}
      {active !== null && <EditorDialog columnDialog title={`ตั้งค่าคอลัมน์ที่ ${active + 1}`} onClose={() => setActive(null)} footer={<button className="primary" onClick={() => setActive(null)}>เสร็จแล้ว</button>}><ColumnEditor hideKey column={cols[active]} columns={cols} tables={tables} prefix={`new-${active}`} onChange={patch => upd(active, patch)}/></EditorDialog>}
    </EditorDialog>}
  </>;
}
