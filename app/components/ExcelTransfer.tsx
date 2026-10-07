"use client";
import { useState } from "react";
import EditorDialog from "./EditorDialog";
import SearchSelect from "./SearchSelect";
import Icon from "./Icon";
import type { TableAccess } from "@/lib/access";
import type { ImportReport } from "@/lib/excel";
export default function ExcelTransfer({ table, rights, onClose, onImported }: {
    table: string;
    rights: TableAccess;
    onClose: () => void;
    onImported: (message: string) => void;
}) {
    const [file, setFile] = useState<File | null>(null), [mode, setMode] = useState(rights.create ? 'append' : 'update'), [sheet, setSheet] = useState(''), [report, setReport] = useState<ImportReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function download(template = false) { setBusy(true); setError(''); try {
        const r = await fetch('/api/excel/' + table + (template ? '?template=1' : ''));
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
    return <EditorDialog wide title="นำเข้า / ส่งออก Excel" busy={busy} onClose={onClose} footer={<><button disabled={busy} onClick={onClose}>ปิด</button>{file && <button className="primary" disabled={busy || !report?.valid} onClick={() => send(true)}>{busy ? 'กำลังทำรายการ…' : 'ยืนยันนำเข้าข้อมูล'}</button>}</>}><div className="excel-transfer"><h3>ส่งออกข้อมูล</h3><p className="field-help">ส่งออกเฉพาะแถวที่บัญชีคุณมีสิทธิ์ดู สูงสุด 10,000 แถว ใช้ชื่อคอลัมน์ในระบบเพื่อให้นำกลับเข้าได้</p><div className="row"><button disabled={busy} onClick={() => download()}><Icon name="download"/>ดาวน์โหลด Excel</button><button disabled={busy} onClick={() => download(true)}>ดาวน์โหลดไฟล์ตัวอย่าง</button></div>{(rights.create || rights.update) && <><h3>นำเข้าข้อมูล</h3><p className="field-help">รองรับ .xlsx ไม่เกิน 10 MB / 5,000 แถว หัวคอลัมน์อยู่แถวแรก ช่องคำนวณจะถูกข้าม นำเข้าสูตร Excel ไม่ได้ ให้แปลงเป็นค่าก่อน ระบบตรวจทุกแถวและสำรองฐานข้อมูลอัตโนมัติก่อนบันทึก</p><div className="field"><label htmlFor="excel-file">ไฟล์ Excel</label><div className="row"><button type="button" disabled={busy} onClick={() => document.getElementById("excel-file")?.click()}>เลือกไฟล์ Excel</button><span className="hint">{file?.name || "ยังไม่ได้เลือกไฟล์"}</span></div><input hidden aria-label="ไฟล์ Excel" id="excel-file" type="file" accept=".xlsx" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setReport(null); setSheet(''); setError(''); }}/></div><div className="field"><label htmlFor="excel-mode">รูปแบบนำเข้า</label><SearchSelect id="excel-mode" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setReport(null); }}>{rights.create && <option value="append">เพิ่มข้อมูลใหม่ · สร้าง id อัตโนมัติ</option>}{rights.update && <option value="update">แก้ไขแถวเดิม · จับคู่ด้วย id</option>}</SearchSelect></div>{report && report.sheets.length > 1 && <div className="field"><label htmlFor="excel-sheet">ชีตข้อมูล</label><SearchSelect id="excel-sheet" value={sheet} disabled={busy} onChange={e => { setSheet(e.target.value); setReport({ ...report, valid: false, samples: [], issues: [] }); }}>{report.sheets.map(s => <option key={s} value={s}>{s}</option>)}</SearchSelect></div>}<button disabled={!file || busy} onClick={() => send()}>{busy ? 'กำลังตรวจ…' : 'ตรวจไฟล์ก่อนนำเข้า'}</button>{report && <><p className={report.valid ? 'success-banner' : 'error-banner'} role="status">{report.valid ? 'ข้อมูลผ่านการตรวจ' : 'ยังนำเข้าไม่ได้'} · {report.total} แถว{report.valid ? ' · ยังไม่ได้บันทึก' : ''}</p>{report.issues.length > 0 && <ul className="err">{report.issues.map((e, i) => <li key={i}>แถว Excel {e.row}: {e.message}</li>)}</ul>}{report.samples.length > 0 && <div className="scroll excel-preview"><table><caption>ตัวอย่างข้อมูลที่ผ่านการตรวจ (สูงสุด 10 แถว)</caption><thead><tr>{report.columns.map(c => <th key={c.name}>{c.label}<small>{c.name}</small></th>)}</tr></thead><tbody>{report.samples.map((r, i) => <tr key={i}>{report.columns.map(c => <td key={c.name}>{Array.isArray(r[c.name]) ? JSON.stringify(r[c.name]) : String(r[c.name] ?? '—')}</td>)}</tr>)}</tbody></table></div>}</>}</>}{error && <p className="error-banner" role="alert">{error}</p>}</div></EditorDialog>;
}
