"use client";
import TableTabs from "@/app/components/TableTabs";
import SearchSelect from "@/app/components/SearchSelect";
import AppLoading from "@/app/components/AppLoading";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ColumnEditor, { typeName } from "@/app/components/ColumnEditor";
import DuplicateInspector from "@/app/components/DuplicateInspector";
import ColumnConversionDialog from "@/app/components/ColumnConversionDialog";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import EditorDialog from "@/app/components/EditorDialog";
import Icon from "@/app/components/Icon";
import ColumnCell, { ColumnToggle } from "@/app/components/ColumnCell";
import { metadataChanged } from "@/app/components/AppShell";
import { blankColumn, Column, formulaErrors, UNIQUE_TYPES } from "@/lib/columns";
type Table = { name: string; label: string; columns: Column[]; related?: {table:string;column:string;label:string;list_limit:number}[] };
export default function EditStructure() {
  const { table } = useParams<{ table: string }>(), router = useRouter();
  const [tables, setTables] = useState<Table[]>([]), [loaded, setLoaded] = useState(false), [label, setLabel] = useState("");
  const [editor, setEditor] = useState<{ original?: string; column: Column } | null>(null), [query, setQuery] = useState("");
  const [err, setErr] = useState(""), [success, setSuccess] = useState(""), [busy, setBusy] = useState(false), [tableSettings, setTableSettings] = useState(false);
  const [rename, setRename] = useState<string | null>(null), [deletion, setDeletion] = useState<{ name?: string; label: string } | null>(null);
  const [duplicates,setDuplicates]=useState<string|null>(null);
  const [conversion,setConversion]=useState<Column|null>(null);
  const meta = tables.find(t => t.name === table);
  const load = async () => { const r = await fetch("/api/tables"), all = await r.json(); if (!r.ok) throw new Error(all.error); setTables(all); const m = all.find((t: Table) => t.name === table); if (m) setLabel(m.label); setLoaded(true); };
  useEffect(() => { setLoaded(false); load().catch(e => { setErr(e.message || "โหลดโครงสร้างไม่ได้"); setLoaded(true); }); }, [table]);
  const closeEditor = () => {
    if (busy) return;
    const original = meta?.columns.find(c => c.name === editor?.original);
    if (editor && (editor.original ? JSON.stringify(editor.column) !== JSON.stringify(original) : !!editor.column.label.trim() || !!editor.column.virtual_expr?.trim())) {
      setDiscard(true); return;
    }
    setEditor(null); setRename(null); setErr("");
  };
  const [discard, setDiscard] = useState(false);
  async function patch(body: any) {
    setErr(""); setSuccess(""); setBusy(true);
    try { const r = await fetch(`/api/tables/${table}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), j = await r.json(); if (!r.ok) throw new Error(j.error); await load(); metadataChanged(); setSuccess("บันทึกการแก้ไขแล้ว"); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : "บันทึกไม่ได้ กรุณาลองใหม่"); return false; }
    finally { setBusy(false); }
  }
  const add = (virtual = false) => { let i = 1; while (meta?.columns.some(c => c.name === `column_${i}`)) i++; setErr(""); setRename(null); setEditor({ column: { ...blankColumn(), name: `column_${i}`, is_virtual: virtual } }); };
  const open = (c: Column) => { setErr(""); setRename(null); setEditor({ original: c.name, column: { ...c } }); };
  const candidate = editor && meta ? editor.original ? meta.columns.map(c => c.name === editor.original ? editor.column : { ...c, ...(editor.column.is_key ? { is_key: 0 } : {}), ...(editor.column.is_label && (c.type==="image")===(editor.column.type==="image") ? { is_label: 0 } : {}) }) : [...meta.columns, editor.column] : meta?.columns || [];
  async function saveColumn() {
    if (!editor) return;
    if (!editor.column.label.trim()) return setErr("กรุณากรอกชื่อที่แสดงของคอลัมน์");
    const error = Object.values(formulaErrors(candidate))[0]; if (error) return setErr(error);
    if (await patch(editor.original ? { ...editor.column, op: "edit_column" } : { op: "add_column", column: editor.column })) { setEditor(null); setRename(null); }
  }
  async function renameColumn() {
    if (!editor?.original) return;
    const original = meta?.columns.find(c => c.name === editor.original);
    if (JSON.stringify(editor.column) !== JSON.stringify(original)) {
      setErr("กรุณาบันทึกการแก้ไขคอลัมน์ก่อน แล้วเปิดคอลัมน์อีกครั้งเพื่อเปลี่ยนชื่อในระบบ"); return;
    }
    if (await patch({ op: "rename_column", name: editor.original, new_name: rename })) { setRename(null); setEditor(null); }
  }
  async function remove() {
    if (!deletion) return;
    if (deletion.name) { if (await patch({ op: "drop_column", name: deletion.name })) { setDeletion(null); setEditor(null); } return; }
    setBusy(true); setErr("");
    try { const r = await fetch(`/api/tables/${table}`, { method: "DELETE" }), j = await r.json(); if (!r.ok) throw new Error(j.error); metadataChanged(); router.push("/"); }
    catch (e) { setErr(e instanceof Error ? e.message : "ลบตารางไม่ได้"); } finally { setBusy(false); }
  }
  if (!loaded) return <AppLoading/>;
  if (!meta) return <><p>{err || "ไม่พบตารางนี้"}</p><Link href="/">กลับหน้าหลัก</Link></>;
  const showInternalId = "id รหัสภายใน key อัตโนมัติ auto".includes(query.trim().toLocaleLowerCase());
  const filtered = meta.columns.filter(c => `${c.name} ${c.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <div className="page-heading"><div><div className="eyebrow">ตั้งค่าตาราง</div><h1>{meta.label}</h1><p>กำหนดช่องข้อมูล การคำนวณ และเงื่อนไขของฟอร์ม</p></div><div className="heading-actions"><Link className="button" href={`/t/${table}`}><Icon name="eye"/>เปิดหน้าข้อมูล</Link><button aria-label="ตั้งค่าตาราง" onClick={() => { setErr(""); setTableSettings(true); }}><Icon name="settings"/>ตั้งค่าตาราง</button></div></div>
    <TableTabs table={table} selected="columns"/>
    <div className="table-identities"><span>Key ระบบ: <strong>id (อัตโนมัติ)</strong></span><span>Key ในแอป: <strong>{meta.columns.find(c => c.is_key)?.label || "ยังไม่ได้เลือก"}</strong></span><span>Label ข้อความ: <strong>{meta.columns.find(c => c.is_label&&c.type!=="image")?.label || meta.columns.find(c => c.type === "text")?.label || "id"}</strong></span><span>Label รูปภาพ: <strong>{meta.columns.find(c=>c.is_label&&c.type==="image")?.label||"ยังไม่ได้เลือก"}</strong></span></div>
    {success && <div className="success-banner" role="status"><Icon name="check"/>{success}</div>}{err && !editor && !tableSettings && !deletion && <div className="error-banner" role="alert">{err}</div>}
    <section className="panel columns-panel"><div className="section-toolbar"><div><h2>คอลัมน์</h2><p className="hint">{meta.columns.length} คอลัมน์ที่กำหนดเอง · id อัตโนมัติ 1 คอลัมน์</p></div><div className="search-box column-grid-search"><Icon name="search"/><input aria-label="ค้นหาคอลัมน์" placeholder="ค้นหาคอลัมน์…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="heading-actions"><button disabled={busy} onClick={()=>setDuplicates("")}>ตรวจข้อมูลซ้ำ</button><button onClick={() => add(true)}><Icon name="formula"/>เพิ่มช่องคำนวณ</button><button className="primary" onClick={() => add()}><Icon name="plus"/>เพิ่มคอลัมน์</button></div></div>
      <p className="column-grid-help">id เป็น Key อัตโนมัติที่ใช้เชื่อมข้อมูลและแก้ไม่ได้ ส่วน Key ในแอปกำหนดเองได้ · กดไอคอนดินสอเพื่อตั้งค่าคอลัมน์ เลื่อนตารางไปทางขวาเพื่อดูช่องเพิ่มเติม</p>
      <div className="column-grid-scroll" tabIndex={0} role="region" aria-label="ตารางจัดการคอลัมน์"><table className="column-grid"><thead><tr><th aria-label="แก้ไข"/><th>ชื่อในระบบ</th><th>ชนิดข้อมูล</th><th>Key</th><th>Label</th><th>ห้ามซ้ำ</th><th>สูตรคำนวณ</th><th>แสดงเมื่อ</th><th>แก้ไขได้</th><th>แก้ไขเมื่อ</th><th>จำเป็น</th><th>ค่าเริ่มต้น</th><th>ชื่อที่แสดง</th></tr></thead><tbody>{showInternalId && <InternalIdRow/>}{filtered.map(c=><tr key={c.name}><td><span className="row-index">{meta.columns.indexOf(c)+2}</span><button className="icon-button" disabled={busy} onClick={()=>open(c)} aria-label={`แก้ไขคอลัมน์ ${c.label}`} title={`ตั้งค่า ${c.label}`}><Icon name="edit" width="17" height="17"/></button></td><td><input readOnly value={c.name} aria-label={`ชื่อในระบบ ${c.label}`}/>{!!c.is_virtual&&<small className="hint">ช่องคำนวณ</small>}{!!c.gps_auto&&<small className="hint">ตำแหน่งปัจจุบัน · GPS</small>}</td><td><SearchSelect disabled value={c.type} aria-label={`ชนิดข้อมูล ${c.label}`} title="ใช้ปุ่มแปลงชนิดข้อมูลในหน้าตั้งค่าคอลัมน์ เพื่อตรวจก่อนเปลี่ยน"><option value={c.type}>{typeName(c.type)}</option></SearchSelect></td><td><ColumnToggle label={`Key ${c.label}`} value={!!c.is_key} disabled={busy||!!c.is_virtual||!["text","number","decimal","enum"].includes(c.type)} onSave={value=>patch({...c,op:"edit_column",is_key:value})}/></td><td><ColumnToggle label={`Label ${c.label}`} value={!!c.is_label} disabled={busy||["ref","enumlist","list"].includes(c.type)} onSave={value=>patch({...c,op:"edit_column",is_label:value})}/></td><td><ColumnToggle label={`ห้ามซ้ำ ${c.label}`} value={!!c.is_unique||!!c.is_key} disabled={busy||!!c.is_key||!!c.is_virtual||!UNIQUE_TYPES.includes(c.type)} onSave={value=>patch({...c,op:"edit_column",is_unique:value})}/></td><td><ColumnCell value={c.virtual_expr||""} label={`สูตรคำนวณ ${c.label}`} disabled={busy||!c.is_virtual} formula onSave={value=>patch({...c,op:"edit_column",virtual_expr:value})}/></td><td><ColumnCell value={c.show_if||""} label={`แสดงเมื่อ ${c.label}`} disabled={busy} formula onSave={value=>patch({...c,op:"edit_column",show_if:value})}/></td><td><ColumnToggle label={`แก้ไขได้ ${c.label}`} value={!c.is_virtual&&c.is_editable!==0&&c.is_editable!==false} disabled={busy||!!c.is_virtual} onSave={value=>patch({...c,op:"edit_column",is_editable:value})}/></td><td><ColumnCell formula label={`แก้ไขเมื่อ ${c.label}`} value={c.editable_if||""} disabled={busy||!!c.is_virtual||c.is_editable===0||c.is_editable===false} onSave={value=>patch({...c,op:"edit_column",editable_if:value})}/></td><td><ColumnToggle label={`จำเป็น ${c.label}`} value={!!c.required||!!c.is_key} disabled={busy||!!c.is_virtual||!!c.is_key} onSave={value=>patch({...c,op:"edit_column",required:value})}/></td><td><ColumnCell value={c.default_expr||""} label={`ค่าเริ่มต้น ${c.label}`} disabled={busy||!!c.is_virtual||!!c.gps_auto} formula onSave={value=>patch({...c,op:"edit_column",default_expr:value})}/></td><td><ColumnCell value={c.label} label={`ชื่อที่แสดง ${c.name}`} disabled={busy} onSave={value=>{if(!value.trim()){setErr("กรุณากรอกชื่อที่แสดงของคอลัมน์");return Promise.resolve(false);}return patch({...c,op:"edit_column",label:value});}}/></td></tr>)}</tbody></table></div>
      {!filtered.length && !showInternalId && <div className="empty">ไม่พบคอลัมน์ที่ค้นหา</div>}
    </section>{!!meta.related?.length && <section className="panel related-settings"><h2>รายการที่เกี่ยวข้อง (Related)</h2><p className="hint">สร้างอัตโนมัติจาก Ref แสดงในรายละเอียดแต่ละแถว โดยดึงข้อมูลทีละหน้า</p>{meta.related.map(r=><div className="related-setting" key={r.table+":"+r.column}><div><strong>{r.label}</strong><small className="hint">{r.table}[{r.column}] → {meta.name}</small></div><label>จำนวนรายการต่อหน้า<SearchSelect aria-label={"จำนวน Related ต่อหน้า " + r.label} disabled={busy} value={r.list_limit} onChange={async e=>{setBusy(true);setErr("");try{const response=await fetch("/api/tables/"+r.table,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"edit_column",name:r.column,list_limit:Number(e.target.value)})}),j=await response.json();if(!response.ok)throw Error(j.error);await load();metadataChanged();setSuccess("บันทึกจำนวนรายการต่อหน้าแล้ว");}catch(error){setErr((error as Error).message);}finally{setBusy(false);}}}>{[5,10,20,0].map(n=><option key={n} value={n}>{n ? n+" รายการ" : "ทั้งหมด"}</option>)}</SearchSelect></label></div>)}</section>}<p className="backup-note"><Icon name="database" width="16" height="16"/>ก่อนเปลี่ยนโครงสร้างหรือสูตร กรุณาปิดแอปและสำรอง data.db</p>
    {editor && <EditorDialog columnDialog title={editor.original ? `แก้ไขคอลัมน์ ${meta.columns.find(c => c.name === editor.original)?.label || editor.original}` : editor.column.is_virtual ? "เพิ่มช่องคำนวณ" : "เพิ่มคอลัมน์"} subtitle={editor.original ? `ชื่อในระบบ: ${editor.original}` : "ตั้งชื่อและเลือกชนิดข้อมูล ระบบตั้งชื่อในระบบให้แล้ว"} busy={busy} onClose={closeEditor}
      footer={<><button disabled={busy} onClick={closeEditor}>ยกเลิก</button><button className="primary" disabled={busy} onClick={saveColumn}><Icon name="check"/>{busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button></>}>
      <ColumnEditor column={editor.column} columns={candidate} tables={tables} prefix="column" existing={!!editor.original} busy={busy} onCheckDuplicates={editor.original?()=>setDuplicates(editor.original!):undefined} onChange={p => { setErr(""); setEditor({ ...editor, column: { ...editor.column, ...p } }); }}/>
      {editor.original&&!editor.column.is_virtual&&<section className="settings-section"><h3>แปลงหรือคัดลอกข้อมูล</h3><p className="hint">ตรวจค่าทุกแถวก่อนเปลี่ยนชนิด มีตัวอย่างก่อน–หลัง และสำรองอัตโนมัติ</p><button disabled={busy} onClick={()=>{const original=meta.columns.find(c=>c.name===editor.original)!;if(JSON.stringify(editor.column)!==JSON.stringify(original)){setErr("กรุณาบันทึกการแก้ไขคอลัมน์ก่อน แล้วเปิดคอลัมน์อีกครั้งเพื่อแปลงข้อมูล");return;}setConversion(original);}}>แปลงชนิดข้อมูล</button></section>}
      {editor.original && <details className="settings-section advanced"><summary>เปลี่ยนชื่อในระบบหรือลบคอลัมน์</summary><div className="row"><button disabled={busy} onClick={() => setRename(editor.original!)}><Icon name="edit"/>เปลี่ยนชื่อในระบบ</button><button className="danger" disabled={busy} onClick={() => { setErr(""); setDeletion({ name: editor.original, label: editor.column.label }); }}><Icon name="trash"/>ลบคอลัมน์</button></div>
        {rename !== null && <div className="field"><label htmlFor="rename-name">ชื่อใหม่ในระบบ</label><input id="rename-name" value={rename} disabled={busy} onChange={e => setRename(e.target.value)}/><small className="hint">สูตรที่อ้างถึงคอลัมน์นี้จะปรับชื่อตามไปด้วย</small><button disabled={busy} onClick={renameColumn}>บันทึกชื่อใหม่</button></div>}
      </details>}{err && <div className="error-banner" role="alert">{err}</div>}
    </EditorDialog>}
    {duplicates!==null&&<DuplicateInspector table={table} columns={meta.columns} initial={duplicates||undefined} onClose={()=>setDuplicates(null)}/>}
    {conversion&&<ColumnConversionDialog table={table} column={conversion} tables={tables} onClose={()=>setConversion(null)} onSaved={async message=>{await load();metadataChanged();setEditor(null);setRename(null);setSuccess(message);}}/>}
    {tableSettings && <EditorDialog title="ตั้งค่าตาราง" subtitle={meta.name} busy={busy} onClose={() => { setTableSettings(false); setErr(""); setLabel(meta.label); }} footer={<><button disabled={busy} onClick={() => { setTableSettings(false); setLabel(meta.label); }}>ยกเลิก</button><button className="primary" disabled={busy} onClick={async () => { if (await patch({ op: "label", label })) setTableSettings(false); }}>บันทึกชื่อตาราง</button></>}><div className="field"><label htmlFor="edit-table-label">ชื่อที่แสดงของตาราง</label><input id="edit-table-label" value={label} disabled={busy} onChange={e => setLabel(e.target.value)}/></div><details className="settings-section"><summary>ลบตาราง</summary><p className="hint">ลบข้อมูลทั้งหมดในตารางนี้ ย้อนกลับไม่ได้</p><button className="danger" disabled={busy} onClick={() => { setErr(""); setDeletion({ label: meta.label }); }}><Icon name="trash"/>ลบตารางนี้ทั้งตาราง</button></details>{err && <div className="error-banner" role="alert">{err}</div>}</EditorDialog>}
    {deletion && <ConfirmDialog titleId="delete-title" busy={busy} onCancel={() => { setDeletion(null); setErr(""); }}><h2 id="delete-title">ยืนยันลบ{deletion.name ? "คอลัมน์" : "ตาราง"} {deletion.label}</h2><p>ข้อมูลจะถูกลบและย้อนกลับไม่ได้ กรุณาสำรอง data.db ก่อน</p>{err && <p className="err" role="alert">{err}</p>}<div className="row"><button className="danger" disabled={busy} onClick={remove}>ยืนยันการลบ</button><button autoFocus disabled={busy} onClick={() => { setDeletion(null); setErr(""); }}>ยกเลิกการลบ</button></div></ConfirmDialog>}
    {discard && <ConfirmDialog titleId="discard-title" busy={false} onCancel={() => setDiscard(false)}><h2 id="discard-title">ยังไม่ได้บันทึกการแก้ไข</h2><p>ต้องการกลับไปแก้ต่อ หรือปิดโดยไม่บันทึก?</p><div className="row"><button className="primary" autoFocus onClick={() => setDiscard(false)}>กลับไปแก้ต่อ</button><button onClick={() => { setDiscard(false); setEditor(null); setRename(null); setErr(""); }}>ปิดโดยไม่บันทึก</button></div></ConfirmDialog>}
  </>;
}


// Display the SQLite primary key without adding a synthetic column to metadata
// or passing it through the editable column/save/conversion flows.
function InternalIdRow() {
  const fixed = (label: string, value: string) => <input disabled readOnly aria-label={label+" id"} value={value}/>;
  const flag = (label: string, checked: boolean) => <input type="checkbox" disabled readOnly aria-label={label+" id"} checked={checked}/>;
  return <tr className="system-column-row" aria-label="คอลัมน์ id รหัสภายในอัตโนมัติ">
    <td><span className="row-index">1</span><span className="system-column-lock" title="คอลัมน์ระบบ แก้ไข เปลี่ยนชื่อ หรือลบไม่ได้"><Icon name="lock" width="17" height="17"/></span></td>
    <td>{fixed("ชื่อในระบบ","id")}<small className="hint">คอลัมน์ระบบ · แก้ไขไม่ได้</small></td>
    <td>{fixed("ชนิดข้อมูล","จำนวนเต็ม (Number)")}</td>
    <td>{flag("Key อัตโนมัติ",true)}<small className="system-column-auto">Auto</small></td>
    <td>{flag("Label",false)}</td>
    <td>{flag("ห้ามซ้ำ",true)}</td>
    <td>{fixed("สูตรคำนวณ","")}</td>
    <td>{fixed("แสดงเมื่อ","")}</td>
    <td>{flag("แก้ไขได้",false)}</td>
    <td>{fixed("แก้ไขเมื่อ","")}</td>
    <td>{flag("จำเป็น",true)}</td>
    <td>{fixed("ค่าเริ่มต้น","อัตโนมัติ")}</td>
    <td>{fixed("ชื่อที่แสดง","รหัสภายใน")}</td>
  </tr>;
}
