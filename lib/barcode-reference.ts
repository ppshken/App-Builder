import {tableAccess} from './access';
﻿import {db,columnsOf,tableExists} from './db';
import {assertTablePermission,currentAccess} from './permissions';
import {rowAllowed} from './row-access';
import {normalizeValue} from './columns';
import {scanCode} from './barcode';
import {AuthError} from './auth';
export function resolveScannedReference(table:string,column:unknown,code:unknown){assertTablePermission(table,'read');const rights=tableAccess(currentAccess(),table);if(!rights.create&&!rights.update)throw new AuthError('ไม่มีสิทธิ์กรอกข้อมูลตารางนี้',403);if(!tableExists(table)||typeof column!=='string')throw new AuthError('ไม่พบช่องสแกน');const c=columnsOf(table).find(c=>c.name===column&&c.type==='ref'&&!c.is_virtual&&c.scan_enabled&&c.is_editable!==0&&c.is_editable!==false);if(!c?.ref_table)throw new AuthError('ช่องนี้ไม่ได้เปิดการสแกน Ref');assertTablePermission(c.ref_table,'read');const cols=columnsOf(c.ref_table),key=cols.find(c=>c.is_key&&!c.is_virtual);if(!key)throw new AuthError('กรุณากำหนด Key ในตารางอ้างอิงก่อนสแกน');const value=normalizeValue(key,scanCode(code));const rows=db.prepare('SELECT * FROM "t_'+c.ref_table+'" WHERE "'+key.name+'"=? LIMIT 2').all(value as any) as Record<string,any>[];const visible=rows.filter(row=>rowAllowed(c.ref_table!,row,'read'));if(rows.length!==1||visible.length!==1)throw new AuthError('ไม่พบรายการที่เลือกได้จากรหัสนี้ หรือไม่มีสิทธิ์ดูรายการ');return {id:Number(visible[0].id)};}
