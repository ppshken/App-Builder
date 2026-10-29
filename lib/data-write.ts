import {allocateAutoNumbers} from './auto-number';
import {traceAction} from "./action-trace";
import {assertRowVersion} from "./row-version";
import {recordWorkflowEvent} from "./workflows";
import {writeChildGroups,assertParentParts} from "./part-of-records";
import { AuthError } from "./auth";
import { db, columnsOf, tableExists } from "./db";
import { calculateInsertRow, applyEditResets, assertEditableChanges, validateRow } from "./columns";
import { assertTablePermission, assertReferenceWrites, currentUser } from "./permissions";
import { assertRowAllowed } from "./row-access";
import { expressionContext } from "./expression-context";
import { assertUniqueRow } from "./unique";
import {checkFiles} from "./files";
import { checkImages } from "./images";
import { checkLists } from "./lists";
import { cascadeEnumListValues } from "./enumlist-reference-updates";
export type WriteOptions={depth:number;budget:{count:number};parents?:Map<string,{table:string;id:number}>;link?:{column:string;id:number}};
export function writeRecord(table: string, body: Record<string, any>, id?: number, options:WriteOptions={depth:0,budget:{count:0}}):{id:number;ok?:boolean} {
    options.parents ??= new Map();
    if(options.depth>8)throw Error("ฟอร์มรายการลูกซ้อนเกิน 8 ชั้น กรุณาลดจำนวนชั้น");
    assertTablePermission(table, "read");
    assertTablePermission(table, id ? "update" : "create");
    if (!tableExists(table))
        throw new AuthError("ไม่พบตาราง", 404);
    const cols = columnsOf(table), now = new Date(), email = currentUser()?.email || "", context = expressionContext(now, email);
    if (!id && Object.hasOwn(body, "id"))
        throw Error("id เป็นรหัสภายในที่ระบบสร้างให้ กรุณากำหนดรหัสของคุณในคอลัมน์ Key แทน");
    if (id && Object.hasOwn(body, "id") && Number(body.id) !== id)
        throw Error("เปลี่ยน id ไม่ได้ เพราะใช้เชื่อมข้อมูล กรุณาแก้รหัสในคอลัมน์ Key แทน");
    return db.transaction(() => {
        const old = id ? db.prepare(`SELECT * FROM "t_${table}" WHERE id=?`).get(id) as Record<string, any> | undefined : undefined;
        if(old)assertRowAllowed(table,old,"update");
        if(id)assertRowVersion(table,cols,old,body.__version);
        if (id && !old)
            throw new AuthError("ไม่พบข้อมูล", 404);
        if (old)
            assertRowAllowed(table, old, "update");
        const input = Object.fromEntries(cols.filter(c => !c.is_virtual && Object.hasOwn(body, c.name)).map(c => [c.name, body[c.name]]));
        const generated=old?{}:allocateAutoNumbers(db,table,cols,input);
        const insertColumns=cols.map(c=>c.auto_number?{...c,auto_number:null,is_editable:true}:c);
        const candidate = old ? { ...old, ...input } : calculateInsertRow(insertColumns, {...input,...generated}, now, email, context);
        if(options.link)candidate[options.link.column]=options.link.id;
        assertReferenceWrites(cols, candidate, old);
        if (old)
            assertEditableChanges(cols, old, candidate, now, email, context);
        const resetCandidate=old?applyEditResets(cols,old,candidate,now,email,context).row:candidate;
        assertReferenceWrites(cols, resetCandidate, old);
        const row = validateRow(cols, resetCandidate, now, email, context);
        if (id)
            assertRowAllowed(table, row, "update");
        assertUniqueRow(db, table, cols, row, id);
        checkImages(cols, row);
        checkFiles(cols,row);
        checkLists(cols, row);
        for(const c of cols.filter(c=>(c.is_part_of||c.related_required)&&c.ref_table)){for(const parentId of [old?.[c.name],row[c.name]])if(parentId)options.parents!.set(c.ref_table+":"+parentId,{table:c.ref_table!,id:Number(parentId)});}
        const validateParents=()=>{if(options.depth===0)for(const parent of options.parents!.values())assertParentParts(parent.table,parent.id);};
        const values = Object.fromEntries(cols.filter(c => !c.is_virtual).map(c => [c.name, ['enumlist', 'list'].includes(c.type) ? JSON.stringify(row[c.name] ?? []) : row[c.name]])), keys = Object.keys(values);
        if (id) {
            if (keys.length)
                db.prepare(`UPDATE "t_${table}" SET ${keys.map(k => `"${k}"=@${k}`).join(',')} WHERE id=@__id`).run({ ...values, __id: id });
            cascadeEnumListValues(db, table, cols, old!, row);
            writeChildGroups(table,id,body.__children,options);
            validateParents();
            recordWorkflowEvent(table,"update",db.prepare(`SELECT * FROM "t_${table}" WHERE id=?`).get(id) as Record<string,any>,old);
            traceAction({kind:"mutation",label:"อัปเดตแถวหลังตรวจสอบ",table,row_id:id,before:old,after:{...row,id},status:"update"});
            return { id, ok: true };
        }
        const result = keys.length ? db.prepare(`INSERT INTO "t_${table}"(${keys.map(k => `"${k}"`).join(',')}) VALUES(${keys.map(k => '@' + k).join(',')})`).run(values) : db.prepare(`INSERT INTO "t_${table}" DEFAULT VALUES`).run();
        const newId = Number(result.lastInsertRowid);
        assertRowAllowed(table, { ...row, id: newId }, "create");
        writeChildGroups(table,newId,body.__children,options);
        validateParents();
        recordWorkflowEvent(table,"create",db.prepare(`SELECT * FROM "t_${table}" WHERE id=?`).get(newId) as Record<string,any>);
        traceAction({kind:"mutation",label:"เพิ่มแถว",table,row_id:newId,before:null,after:{...row,id:newId},status:"create"});
        return { id: newId };
    }).immediate();
}
