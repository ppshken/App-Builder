import ExcelJS from "exceljs";
import { db, columnsOf, tableExists } from "./db";
import { calculateRow } from "./columns";
import { currentUser, assertTablePermission } from "./permissions";
import { visibleRawRows } from "./row-access";
import { expressionContext } from "./expression-context";
import { writeRecord } from "./data-write";
import { errorMessage } from "./api";
export const MAX_EXCEL_BYTES = 10 * 1024 * 1024, MAX_EXCEL_ROWS = 5000;
function inspectZip(bytes: Buffer) { if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50)
    throw Error("เลือกไฟล์ Excel .xlsx ที่ถูกต้อง"); let end = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
    } if (end < 0)
    throw Error("ไฟล์ Excel เสียหาย กรุณาบันทึกเป็น .xlsx ใหม่"); const count = bytes.readUInt16LE(end + 10); let pos = bytes.readUInt32LE(end + 16), size = 0; if (count > 5000)
    throw Error("ไฟล์ Excel มีส่วนประกอบมากเกินไป"); for (let n = 0; n < count; n++) {
    if (pos + 46 > bytes.length || bytes.readUInt32LE(pos) !== 0x02014b50)
        throw Error("โครงสร้างไฟล์ Excel ไม่ถูกต้อง");
    size += bytes.readUInt32LE(pos + 24);
    if (size > 40 * 1024 * 1024)
        throw Error("เนื้อหาในไฟล์ Excel ใหญ่เกินไป กรุณาแบ่งไฟล์");
    pos += 46 + bytes.readUInt16LE(pos + 28) + bytes.readUInt16LE(pos + 30) + bytes.readUInt16LE(pos + 32);
} }
export async function loadExcel(bytes: Buffer) { if (bytes.length > MAX_EXCEL_BYTES)
    throw Error("ไฟล์ Excel ต้องมีขนาดไม่เกิน 10 MB"); inspectZip(bytes); const workbook = new ExcelJS.Workbook(); try {
    await workbook.xlsx.load(bytes as any);
}
catch {
    throw Error("อ่านไฟล์ Excel ไม่ได้ กรุณาบันทึกเป็น .xlsx ใหม่");
} if (!workbook.worksheets.length)
    throw Error("ไฟล์ Excel ไม่มีชีตข้อมูล"); return workbook; }
function cellValue(cell: ExcelJS.Cell, type?: string): any { const v = cell.value; if (v == null)
    return null; if (v instanceof Date) {
    const iso = v.toISOString();
    return type === "date" ? iso.slice(0, 10) : iso.replace("Z", "+07:00");
} if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v)
        throw Error("พบสูตร Excel กรุณาคัดลอกแล้ววางเป็นค่า ก่อนนำเข้า");
    if ('richText' in v)
        return v.richText.map(t => t.text).join('');
    if ('text' in v)
        return v.text;
    throw Error("พบค่าที่ Excel อ่านไม่ได้ กรุณาวางเป็นค่าหรือข้อความ");
} return v; }
export type ImportReport = {
    sheet: string;
    sheets: string[];
    mode: string;
    total: number;
    created: number;
    updated: number;
    valid: boolean;
    columns: {
        name: string;
        label: string;
    }[];
    samples: Record<string, any>[];
    issues: {
        row: number;
        message: string;
    }[];
};
export function importExcel(table: string, workbook: ExcelJS.Workbook, sheetName: string, mode: string, commit = false) { if (!tableExists(table))
    throw Error("ไม่พบตาราง"); if (!['append', 'update'].includes(mode))
    throw Error("เลือกรูปแบบเพิ่มข้อมูลใหม่หรือแก้ไขตาม id"); assertTablePermission(table, mode === 'append' ? 'create' : 'update'); assertTablePermission(table, 'read'); const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0]; if (!sheet)
    throw Error("ไม่พบชีตที่เลือก"); if (sheet.rowCount > MAX_EXCEL_ROWS + 1 || sheet.columnCount > 201)
    throw Error("นำเข้าได้ครั้งละไม่เกิน 5,000 แถว และ 201 คอลัมน์"); const cols = columnsOf(table), headers: {
    index: number;
    name: string;
    label: string;
    type?: string;
}[] = [], seen = new Set<string>(); sheet.getRow(1).eachCell((cell, index) => { const name = String(cellValue(cell) ?? '').trim(); if (!name)
    return; const matches = cols.filter(c => c.name === name || c.label === name), c = cols.find(c => c.name === name) || matches[0]; if (name !== 'id' && (!c || (!cols.some(c => c.name === name) && matches.length > 1)))
    throw Error('หัวคอลัมน์ "' + name + '" ไม่ตรงกับชื่อในระบบหรือซ้ำกับชื่อที่แสดง'); const system = c?.name || 'id'; if (seen.has(system))
    throw Error('หัวคอลัมน์ "' + name + '" ซ้ำ'); seen.add(system); if (c?.is_virtual)
    return; headers.push({ index, name: system, label: c?.label || 'id', type: c?.type }); }); if (!headers.length)
    throw Error("ใส่ชื่อคอลัมน์ในแถวแรกของ Excel"); if (mode === 'update' && !seen.has('id'))
    throw Error("การแก้ไขข้อมูลต้องมีคอลัมน์ id ของแถวเดิม"); const report: ImportReport = { sheet: sheet.name, sheets: workbook.worksheets.map(s => s.name), mode, total: 0, created: 0, updated: 0, valid: false, columns: headers.map(({ name, label }) => ({ name, label })), samples: [], issues: [] }; const rollback = Symbol('preview'); const usedIds = new Set<number>(); try {
    db.transaction(() => { for (let n = 2; n <= sheet.rowCount; n++) {
        const row = sheet.getRow(n);
        if (!row.hasValues)
            continue;
        report.total++;
        try {
            const body: Record<string, any> = {};
            for (const h of headers)
                body[h.name] = cellValue(row.getCell(h.index), h.type);
            let id: number | undefined;
            if (mode === 'update') {
                id = Number(body.id);
                if (!Number.isSafeInteger(id) || id < 1)
                    throw Error("id ต้องเป็นเลขแถวเดิมตั้งแต่ 1");
                if (usedIds.has(id))
                    throw Error("id ซ้ำในไฟล์ กรุณาให้หนึ่งแถวต่อ id");
                usedIds.add(id);
            }
            delete body.id;
            writeRecord(table, body, id);
            if (id)
                report.updated++;
            else
                report.created++;
            if (report.samples.length < 10)
                report.samples.push({ id: id ?? 'สร้างอัตโนมัติ', ...body });
        }
        catch (e) {
            if (report.issues.length < 50)
                report.issues.push({ row: n, message: errorMessage(e) });
        }
    } report.valid = report.total > 0 && !report.issues.length; if (!report.total)
        report.issues.push({ row: 2, message: "ชีตไม่มีข้อมูลให้เพิ่มหรือแก้ไข" }); if (!commit || !report.valid)
        throw rollback; })();
}
catch (e) {
    if (e !== rollback)
        throw e;
} return report; }
export async function exportExcel(table: string, template = false) { assertTablePermission(table, 'read'); if (!tableExists(table))
    throw Error("ไม่พบตาราง"); const cols = columnsOf(table), headers = ['id', ...cols.map(c => c.name)], workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('ข้อมูล'); sheet.addRow(headers); sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; for (const column of sheet.columns)
    column.width = 22; let total = 0; if (!template) {
    const raw = db.prepare('SELECT * FROM "t_' + table + '" ORDER BY id').all() as any[], rows = visibleRawRows(table, raw);
    if (rows.length > 10000)
        throw Error("ส่งออกได้ไม่เกิน 10,000 แถวต่อไฟล์ กรุณาแบ่งข้อมูลก่อน");
    const now = new Date(), email = currentUser()?.email || '', ctx = expressionContext(now, email);
    for (const raw of rows) {
        const row = calculateRow(cols, raw, false, now, false, email, ctx).row;
        sheet.addRow(headers.map(n => Array.isArray(row[n]) ? JSON.stringify(row[n]) : row[n] ?? null));
        total++;
    }
} const guide = workbook.addWorksheet('คู่มือคอลัมน์'); guide.addRow(['ชื่อในระบบ', 'ชื่อที่แสดง', 'ประเภท', 'คำแนะนำ']); guide.addRow(['id', 'รหัสภายใน', 'number', 'สร้างอัตโนมัติเมื่อเพิ่มข้อมูล ใช้ id เดิมเมื่อแก้ไข ห้ามเปลี่ยน']); for (const c of cols)
    guide.addRow([c.name, c.label, c.type, c.is_virtual ? 'คำนวณอัตโนมัติ ไม่นำกลับเข้า' : c.ref_table ? 'ใช้ id จากตาราง ' + c.ref_table : ['list', 'enumlist'].includes(c.type) ? 'รายการ JSON เช่น ["ค่าแรก","ค่าที่สอง"]' : c.type === 'date' ? 'YYYY-MM-DD' : c.type === 'datetime' ? 'YYYY-MM-DDTHH:mm:ss+07:00' : '']); guide.columns.forEach(c => c.width = 35); return { bytes: Buffer.from(await workbook.xlsx.writeBuffer()), total }; }
