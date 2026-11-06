"use client";
import { useState } from "react";
import EditorDialog from "./EditorDialog";
import SearchSelect from "./SearchSelect";
import Icon from "./Icon";
import type { TableAccess } from "@/lib/access";
import type { ImportReport } from "@/lib/excel";
export default function ExcelTransfer({ table, rights, columns, scope="", onClose, onImported }: {
    table: string;
    columns: {name:string;label:string}[];
    scope?: string;
    rights: TableAccess;
    onClose: () => void;
    onImported: (message: string) => void;
}) {
    const canImport=rights.create||rights.update;
    const [tab,setTab]=useState(rights.export?"export":"import");
    const exportTab=tab==="export"&&!!rights.export;
    const title=rights.export&&canImport?"นำเข้า / ส่งออก Excel":rights.export?"ส่งออก Excel":"นำเข้า Excel";
    const [customColumns,setCustomColumns]=useState(false),[selectedColumns,setSelectedColumns]=useState<string[]>(()=>columns.map(c=>c.name));
    const [referenceMode,setReferenceMode]=useState("ids");
    const [file, setFile] = useState<File | null>(null), [mode, setMode] = useState(rights.create ? 'append' : 'update'), [sheet, setSheet] = useState(''), [report, setReport] = useState<ImportReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function download(template = false) { setBusy(true); setError(''); try {
        const r = await fetch('/api/excel/' + table + (template ? '?template=1' : '?references='+referenceMode+(customColumns?'&columns='+encodeURIComponent(selectedColumns.join(',')):'')+(scope?'&'+scope:'')));
        if (!r.ok)
            throw Error((await r.json()).error);
        const url = URL.createObjectURL(await r.blob()), a = document.createElement('a');
        a.href = url;
        a.download = table + (template ? '-template' : '') + '.xlsx';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function send(commit = false) { if (!file)
        return; setBusy(true); setError(''); try {
        const form = new FormData();
        form.set('file', file);
        form.set('mode', mode);
        form.set('sheet', sheet);
        form.set('phase', commit ? 'commit' : 'preview');
        const r = await fetch('/api/excel/' + table, { method: 'POST', body: form }), j = await r.json();
        if (!r.ok)
            throw Error(j.error);
        setReport(j);
        setSheet(j.sheet);
        if (j.committed)
            onImported('นำเข้า Excel แล้ว · เพิ่ม ' + j.created + ' แถว แก้ไข ' + j.updated + ' แถว');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <EditorDialog className="excel-transfer-dialog" title={title} busy={busy} onClose={onClose} footer={<><button disabled={busy} onClick={onClose}>ปิด</button>{exportTab?<button className="primary" disabled={busy||customColumns&&!selectedColumns.length} onClick={()=>download()}><Icon name="download"/>{busy?'กำลังเตรียมไฟล์…':'ดาวน์โหลด Excel'}</button>:canImport&&file&&<button className="primary" disabled={busy||!report?.valid} onClick={()=>send(true)}>{busy?'กำลังทำรายการ…':'ยืนยันนำเข้าข้อมูล'}</button>}</>}><div className="excel-transfer">{rights.export&&canImport&&<div className="excel-transfer-tabs" role="tablist" aria-label="การจัดการไฟล์ Excel"><button type="button" role="tab" aria-selected={exportTab} disabled={busy} onClick={()=>{setTab('export');setError('');}}>ส่งออกข้อมูล</button><button type="button" role="tab" aria-selected={!exportTab} disabled={busy} onClick={()=>{setTab('import');setError('');}}>นำเข้าข้อมูล</button></div>}{exportTab&&<><p className="field-help">{scope?"ส่งออกตาม Slice และการค้นหา / ตัวกรองปัจจุบัน · รวมทุกหน้าที่ตรงเงื่อนไข":"ส่งออกทั้งตาราง เฉพาะข้อมูลที่คุณมีสิทธิ์ดู"} · สูงสุด 10,000 แถว</p><div className="field"><label htmlFor="excel-reference-mode">รูปแบบข้อมูลในไฟล์</label><SearchSelect id="excel-reference-mode" disabled={busy} value={referenceMode} onChange={e=>setReferenceMode(e.target.value)}><option value="ids">ID / Key ของข้อมูล</option><option value="labels">ชื่อข้อมูลและชื่อคอลัมน์ที่แสดง</option><option value="both">ID / Key พร้อมชื่อข้อมูล</option></SearchSelect></div><div className="field excel-column-field"><label>คอลัมน์ที่ส่งออก</label><div className="designer-column-mode" role="group" aria-label="เลือกคอลัมน์ส่งออก"><button type="button" disabled={busy} aria-pressed={!customColumns} onClick={()=>setCustomColumns(false)}>ทุกคอลัมน์</button><button type="button" disabled={busy} aria-pressed={customColumns} onClick={()=>setCustomColumns(true)}>กำหนดคอลัมน์</button></div>{customColumns&&<><div className="excel-column-tools"><small>{selectedColumns.length} / {columns.length} คอลัมน์</small><button type="button" disabled={busy} onClick={()=>setSelectedColumns(columns.map(c=>c.name))}>เลือกทั้งหมด</button><button type="button" disabled={busy} onClick={()=>setSelectedColumns([])}>ล้างทั้งหมด</button></div><div className="excel-column-options" role="group" aria-label="คอลัมน์สำหรับส่งออก">{columns.map(c=><label key={c.name}><input type="checkbox" disabled={busy} checked={selectedColumns.includes(c.name)} onChange={e=>setSelectedColumns(previous=>e.target.checked?[...previous,c.name]:previous.filter(n=>n!==c.name))}/><span>{c.label}<small>{c.name}</small></span></label>)}</div>{!selectedColumns.length&&<small className="err">เลือกอย่างน้อย 1 คอลัมน์</small>}</>}</div><p className="excel-format-hint">{referenceMode==='ids'?'ใช้รหัสอ้างอิงและชื่อคอลัมน์ในระบบ เหมาะสำหรับนำกลับเข้า':referenceMode==='labels'?'ใช้ชื่อข้อมูลแทนรหัสอ้างอิง และชื่อที่แสดงเป็นหัวคอลัมน์ เหมาะสำหรับอ่านรายงาน':'เก็บรหัสเดิม พร้อมเพิ่มคอลัมน์ชื่อข้อมูลไว้ข้างกัน'}</p></>}{!exportTab&&canImport&&<><p className="field-help">เลือกไฟล์ .xlsx ไม่เกิน 10 MB / 5,000 แถว แล้วตรวจไฟล์ก่อนยืนยัน</p><button className="excel-template-button" disabled={busy} onClick={()=>download(true)}>ดาวน์โหลดไฟล์ตัวอย่างสำหรับนำเข้า</button><div className="field"><label htmlFor="excel-file">ไฟล์ Excel</label><div className="row"><button type="button" disabled={busy} onClick={() => document.getElementById("excel-file")?.click()}>เลือกไฟล์ Excel</button><span className="hint">{file?.name || "ยังไม่ได้เลือกไฟล์"}</span></div><input hidden aria-label="ไฟล์ Excel" id="excel-file" type="file" accept=".xlsx" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setReport(null); setSheet(''); setError(''); }}/></div><div className="field"><label htmlFor="excel-mode">รูปแบบนำเข้า</label><SearchSelect id="excel-mode" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setReport(null); }}>{rights.create && <option value="append">เพิ่มข้อมูลใหม่ · สร้าง id อัตโนมัติ</option>}{rights.update && <option value="update">แก้ไขแถวเดิม · จับคู่ด้วย id</option>}</SearchSelect></div>{report && report.sheets.length > 1 && <div className="field"><label htmlFor="excel-sheet">ชีตข้อมูล</label><SearchSelect id="excel-sheet" value={sheet} disabled={busy} onChange={e => { setSheet(e.target.value); setReport({ ...report, valid: false, samples: [], issues: [] }); }}>{report.sheets.map(s => <option key={s} value={s}>{s}</option>)}</SearchSelect></div>}<button disabled={!file || busy} onClick={() => send()}>{busy ? 'กำลังตรวจ…' : 'ตรวจไฟล์ก่อนนำเข้า'}</button>{report && <><p className={report.valid ? 'success-banner' : 'error-banner'} role="status">{report.valid ? 'ข้อมูลผ่านการตรวจ' : 'ยังนำเข้าไม่ได้'} · {report.total} แถว{report.valid ? ' · ยังไม่ได้บันทึก' : ''}</p>{report.issues.length > 0 && <ul className="err">{report.issues.map((e, i) => <li key={i}>แถว Excel {e.row}: {e.message}</li>)}</ul>}{report.samples.length > 0 && <div className="scroll excel-preview"><table><caption>ตัวอย่างข้อมูลที่ผ่านการตรวจ (สูงสุด 10 แถว)</caption><thead><tr>{report.columns.map(c => <th key={c.name}>{c.label}<small>{c.name}</small></th>)}</tr></thead><tbody>{report.samples.map((r, i) => <tr key={i}>{report.columns.map(c => <td key={c.name}>{Array.isArray(r[c.name]) ? JSON.stringify(r[c.name]) : String(r[c.name] ?? '—')}</td>)}</tr>)}</tbody></table></div>}</>}</>}{error && <p className="error-banner" role="alert">{error}</p>}</div></EditorDialog>;
}
