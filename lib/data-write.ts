import { AuthError } from "./auth";
import { db, columnsOf, tableExists } from "./db";
import { calculateInsertRow, assertEditableChanges, validateRow } from "./columns";
import { assertTablePermission, assertReferenceWrites, currentUser } from "./permissions";
import { assertRowAllowed } from "./row-access";
import { expressionContext } from "./expression-context";
import { assertUniqueRow } from "./unique";
import { checkImages } from "./images";
import { checkLists } from "./lists";
import { cascadeEnumListValues } from "./enumlist-reference-updates";
export function writeRecord(table: string, body: Record<string, any>, id?: number) {
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
        if (id && !old)
            throw new AuthError("ไม่พบข้อมูล", 404);
        if (old)
            assertRowAllowed(table, old, "update");
        const input = Object.fromEntries(cols.filter(c => !c.is_virtual && Object.hasOwn(body, c.name)).map(c => [c.name, body[c.name]]));
        const candidate = old ? { ...old, ...input } : calculateInsertRow(cols, input, now, email, context);
        assertReferenceWrites(cols, candidate, old);
        if (old)
            assertEditableChanges(cols, old, candidate, now, email, context);
        const row = validateRow(cols, candidate, now, email, context);
        if (id)
            assertRowAllowed(table, row, "update");
        assertUniqueRow(db, table, cols, row, id);
        checkImages(cols, row);
        checkLists(cols, row);
        const values = Object.fromEntries(cols.filter(c => !c.is_virtual).map(c => [c.name, ['enumlist', 'list'].includes(c.type) ? JSON.stringify(row[c.name] ?? []) : row[c.name]])), keys = Object.keys(values);
        if (id) {
            if (keys.length)
                db.prepare(`UPDATE "t_${table}" SET ${keys.map(k => `"${k}"=@${k}`).join(',')} WHERE id=@__id`).run({ ...values, __id: id });
            cascadeEnumListValues(db, table, cols, old!, row);
            return { id, ok: true };
        }
        const result = keys.length ? db.prepare(`INSERT INTO "t_${table}"(${keys.map(k => `"${k}"`).join(',')}) VALUES(${keys.map(k => '@' + k).join(',')})`).run(values) : db.prepare(`INSERT INTO "t_${table}" DEFAULT VALUES`).run();
        const newId = Number(result.lastInsertRowid);
        assertRowAllowed(table, { ...row, id: newId }, "create");
        return { id: newId };
    })();
}
