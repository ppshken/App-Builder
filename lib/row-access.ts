import type Database from "better-sqlite3";
import { db } from "./db";
import { readColumns } from "./schema";
import { AuthError } from "./auth";
import { currentScopeKey, currentAccess, currentUser } from "./permissions";
import { expressionUser } from "./user-settings";
import { asBoolean, evaluateExpression, references, referencePaths, tableReferences, parseExpression, userSettingReferences } from "./expression";
import { normalizeValue } from "./columns";
export type RowOperation = "read" | "create" | "update" | "delete";
export function validateRowRule(source: unknown, table: string, database: Database.Database = db) { if (typeof source !== "string" || source.length > 4000)
    throw new AuthError("เงื่อนไขแถวต้องเป็นสูตรไม่เกิน 4,000 ตัวอักษร"); if (!source.trim())
    return ""; parseExpression(source); if (userSettingReferences(source).length)
    throw new AuthError("กฎสิทธิ์ไม่ใช้ USERSETTINGS เพราะผู้ใช้แก้ค่าเองได้ ใช้บัญชีหรือสาขาที่กำหนดในกฎแทน"); if (tableReferences(source).length || referencePaths(source).length)
    throw new AuthError("กฎสิทธิ์ใช้คอลัมน์ของแถวนี้และข้อมูลบัญชีได้ ไม่ใช้ SELECT หรือดึงค่าข้ามตาราง"); const names = new Set(['id', ...readColumns(database, table).filter(c => !c.is_virtual).map(c => c.name)]); for (const name of references(source))
    if (!names.has(name))
        throw new AuthError("กฎสิทธิ์ไม่พบคอลัมน์ [" + name + "] หรือเป็นช่องคำนวณ"); return source.trim(); }
const caches = new WeakMap<object, Map<string, any>>();
function cached<T>(key: string, load: () => T, database: Database.Database): T { const access = currentScopeKey() || currentAccess(); let cache = caches.get(access); if (!cache) {
    cache = new Map();
    caches.set(access, cache);
} let store = cache.get(database as any); if (!store) {
    store = new Map();
    cache.set(database as any, store);
} if (!store.has(key))
    store.set(key, load()); return store.get(key); }
export function rowRule(table: string, operation: RowOperation, database: Database.Database = db) { const a = currentAccess(); if (a.owner || a.builder)
    return ""; if(a.applicationRole)return a.rowRules?.[table+":"+operation]||""; return cached(table + ":" + operation, () => (database.prepare("SELECT expression FROM _role_row_rules WHERE role_name=? AND table_name=? AND operation=?").get(currentUser()?.role, table, operation) as {
    expression: string;
} | undefined)?.expression || "", database); }
export function rowAllowed(table: string, row: Record<string, any>, operation: RowOperation = "read", database: Database.Database = db) { const a = currentAccess(); if (a.owner || a.builder)
    return true; const user = currentUser(); if (!user || !a.tables[table]?.read || !a.tables[table]?.[operation])
    return false; try {
    const rule = rowRule(table, operation, database);
    if (!rule)
        return true;
    const values = { ...row };
    for (const c of cached("cols:" + table, () => readColumns(database, table).filter(c => !c.is_virtual), database))
        values[c.name] = normalizeValue(c, row[c.name]);
    return asBoolean(evaluateExpression(rule, values, { ...cached("user", () => expressionUser(user, database), database), userEmail: user.email, now: cached("now", () => new Date(), database) }));
}
catch {
    return false;
} }
export function assertRowAllowed(table: string, row: Record<string, any>, operation: RowOperation = "read", database: Database.Database = db) { if (!rowAllowed(table, row, "read", database) || !rowAllowed(table, row, operation, database))
    throw new AuthError("ไม่มีสิทธิ์เข้าถึงหรือทำรายการกับแถวนี้", 403); }
export function hasRowRule(table: string, database: Database.Database = db) { return !!rowRule(table, "read", database); }
export function visibleRawRows(table: string, rows: Record<string, any>[], database: Database.Database = db) { return rows.filter(row => rowAllowed(table, row, "read", database)); }
