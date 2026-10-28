import {userFieldOptions} from './user-fields';
import {listSource,references} from "./expression";
import {loadReferenceLabels} from "./reference-labels";
import ExcelJS from "exceljs";
import { db, columnsOf, tableExists } from "./db";
import { calculateRow, enumListLabel } from "./columns";
import { currentUser, assertTablePermission, assertExcelExport } from "./permissions";
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
    return null; if(type==="time"&&typeof v==="number"&&v>=0&&v<1){const seconds=Math.floor(v*86400+1e-6);if(seconds>86399)throw Error("เวลา Excel เกินช่วง 00:00:00–23:59:59");return String(Math.floor(seconds/3600)).padStart(2,"0")+":"+String(Math.floor(seconds/60)%60).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");} if (v instanceof Date) {
    const iso = v.toISOString();
    return type === "time" ? iso.slice(11,19) : type === "date" ? iso.slice(0, 10) : iso.replace("Z", "+07:00");
} if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v)
        throw Error("พบสูตร Excel กรุณาคัดลอกแล้ววางเป็นค่า ก่อนนำเข้า");
    if ('richText' in v)
        return v.richText.map(t => t.text).join('');
    if ('text' in v)
        return v.text;
    throw Error("พบค่าที่ Excel อ่านไม่ได้ กรุณาวางเป็นค่าหรือข้อความ");
} if ((type === "text" || type === "longtext") && typeof v === "number" && Number.isFinite(v))
    return String(v); return v; }
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
export async function exportExcel(table:string,template=false,referenceMode:string='ids',selectedColumns?:unknown) {
 assertTablePermission(table,'read');if(!template)assertExcelExport(table);
 if(!['ids','labels','both'].includes(referenceMode))throw Error('รูปแบบข้อมูลอ้างอิงไม่ถูกต้อง');if(template)referenceMode='ids';
 if(!tableExists(table))throw Error('ไม่พบตาราง');
 const cols=columnsOf(table),available=['id',...cols.map(c=>c.name)];
 if(selectedColumns!==undefined&&(!Array.isArray(selectedColumns)||!selectedColumns.length||selectedColumns.length>available.length||new Set(selectedColumns).size!==selectedColumns.length||selectedColumns.some(n=>typeof n!=='string'||!available.includes(n))))throw Error('กรุณาเลือกคอลัมน์ที่ส่งออกอย่างน้อย 1 คอลัมน์ และเลือกเฉพาะคอลัมน์ของตารางนี้');
 const headers=!template&&Array.isArray(selectedColumns)?available.filter(n=>selectedColumns.includes(n)):available,exportCols=cols.filter(c=>headers.includes(c.name)),referenceCols=exportCols.filter(c=>['ref','user'].includes(c.type)||['enum','enumlist','list'].includes(c.type)&&!!(c.ref_table||listSource(c.valid_if||"")));
 const companion=new Map<string,string>(),used=new Set(headers);if(referenceMode==='both')for(const c of referenceCols){let name=c.name+'__label',i=2;while(used.has(name))name=c.name+'__label_'+i++;used.add(name);companion.set(c.name,name);}
 const displayedHeaders=new Set<string>();const outputHeaders=headers.flatMap(n=>companion.has(n)?[n,companion.get(n)!]:[n]).map(n=>{if(referenceMode!=='labels')return n;const label=n==='id'?'รหัสภายใน':cols.find(c=>c.name===n)?.label||n;let heading=label,index=2;while(displayedHeaders.has(heading))heading=label+' ('+(index++)+')';displayedHeaders.add(heading);return heading;});
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('ข้อมูล');sheet.addRow(outputHeaders);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2563EB'}};sheet.views=[{state:'frozen',ySplit:1}];for(const column of sheet.columns)column.width=22;
 let total=0;if(!template){const raw=visibleRawRows(table,db.prepare('SELECT * FROM "t_'+table+'" ORDER BY id').all() as any[]);if(raw.length>10000)throw Error('ส่งออกได้ไม่เกิน 10,000 แถวต่อไฟล์ กรุณาแบ่งข้อมูลก่อน');
 const needed=new Set(headers),queue=[...headers];for(let i=0;i<queue.length;i++){const c=cols.find(c=>c.name===queue[i]);if(c?.is_virtual&&c.virtual_expr)for(const name of references(c.virtual_expr))if(!needed.has(name)){needed.add(name);queue.push(name);}}
 const calculation=cols.filter(c=>needed.has(c.name));const now=new Date(),email=currentUser()?.email||'',ctx=expressionContext(now,email),rows=raw.map(record=>calculateRow(calculation,record,false,now,false,email,ctx).row);
 const labels=referenceMode!=='ids'?loadReferenceLabels(exportCols,rows,now,email,ctx):new Map();
 const userLabels=new Map(exportCols.some(c=>c.type==='user')&&referenceMode!=='ids'?userFieldOptions().map(u=>[u.id,u.nickname||u.name]):[]);
 const cell=(v:unknown)=>Array.isArray(v)?JSON.stringify(v):v??null;
 for(const row of rows){const labelFor=(name:string)=>{const c=referenceCols.find(c=>c.name===name);if(!c)return row[name];const value=row[name];if(value==null||value==='')return null;if(c.type==='user')return userLabels.get(Number(value))||'ผู้ใช้ไม่พร้อมใช้งาน (#'+String(value)+')';if(c.type==='ref')return labels.get(c.ref_table!)?.get(Number(value))?.label??null;return Array.isArray(value)?value.map(v=>enumListLabel(c,String(v),ctx)):enumListLabel(c,String(value),ctx);};sheet.addRow(headers.flatMap(n=>referenceMode==='both'&&companion.has(n)?[cell(row[n]),cell(labelFor(n))]:[cell(referenceMode==='labels'?labelFor(n):row[n])]));for(const c of exportCols){const index=headers.flatMap(n=>companion.has(n)?[n,companion.get(n)!]:[n]).indexOf(c.name)+1;if(c.type==='percent')sheet.getRow(sheet.rowCount).getCell(index).numFmt='0.00%';if(c.type==='price')sheet.getRow(sheet.rowCount).getCell(index).numFmt='฿#,##0.00';}total++;}
 }
 const guide=workbook.addWorksheet('คู่มือคอลัมน์');guide.addRow(['ชื่อในระบบ','ชื่อที่แสดง','ประเภท','คำแนะนำ']);if(headers.includes('id'))guide.addRow(['id','รหัสภายใน','number','สร้างอัตโนมัติเมื่อเพิ่มข้อมูล ใช้ id เดิมเมื่อแก้ไข ห้ามเปลี่ยน']);
 for(const c of exportCols){guide.addRow([c.name,c.label,c.type,c.is_virtual?'คำนวณอัตโนมัติ ไม่นำกลับเข้า':c.ref_table?'ใช้ ID/Key จากตาราง '+c.ref_table:['list','enumlist'].includes(c.type)?'รายการ JSON เช่น ["ค่าแรก","ค่าที่สอง"]':c.type==='user'?'ID ผู้ใช้ที่เปิดใช้งานและมีสิทธิ์เข้าแอป':c.type==='percent'?'ค่า 0–1 หรือข้อความ เช่น 25%':c.type==='price'?'จำนวนเงิน THB':c.type==='rating'?'จำนวนเต็ม 0–5':c.type==='time'?'HH:mm:ss (00:00:00–23:59:59)':c.type==='phone'?'เก็บเป็นข้อความ เพื่อรักษาเลขศูนย์นำหน้า':c.type==='email'?'name@example.com':c.type==='url'?'https://example.com':c.type==='date'?'YYYY-MM-DD':c.type==='datetime'?'YYYY-MM-DDTHH:mm:ss+07:00':'']);if(companion.has(c.name))guide.addRow([companion.get(c.name),c.label+' (ชื่อ)','text','ชื่อสำหรับอ่านรายงาน ไม่ใช้เป็นรหัสนำเข้า']);}
 guide.addRow(['รูปแบบข้อมูลอ้างอิง',referenceMode,'','เลือก ID/Key เมื่อต้องการนำไฟล์กลับเข้าระบบ']);guide.columns.forEach(c=>c.width=35);return {bytes:Buffer.from(await workbook.xlsx.writeBuffer()),total};
}
