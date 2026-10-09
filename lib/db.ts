import {installAuditing} from "./audit-schema";
﻿import Database from "better-sqlite3";
import { resolve } from "node:path";
import { labelTextColumn, IDENT, SQLTYPE, Column } from "./columns";
import { initializeDatabase, readColumns, rebuildTable } from "./schema";

export const databasePath = process.env.NOCODE_DB_PATH ? resolve(process.env.NOCODE_DB_PATH) : resolve("data.db");
const path = databasePath;
export function databaseGeneration(){return (globalThis as any).__nocodeDbGeneration || 0;}
export function markDatabaseRestored(){(globalThis as any).__nocodeDbGeneration = databaseGeneration()+1;}
const schemaVersion = "file-paths-v1";
const g = globalThis as typeof globalThis & { __nocodeDb?: { path: string; db: Database.Database; version?: string } };
function connection() {
  if (!g.__nocodeDb || g.__nocodeDb.path !== path) {
    const opened = new Database(path);
    try { initializeDatabase(opened, path); installAuditing(opened); }
    catch (e) { opened.close(); throw e; }
    g.__nocodeDb = { path, db: opened, version: schemaVersion };
  } else if (g.__nocodeDb.version !== schemaVersion) {
    initializeDatabase(g.__nocodeDb.db, path); installAuditing(g.__nocodeDb.db);
    g.__nocodeDb.version = schemaVersion;
  }
  return g.__nocodeDb.db;
}
// Importing an API module during next build must not open/migrate the user's database.
export const db = new Proxy({} as Database.Database, {
  get(_target, key) {
    const opened = connection();
    const value = Reflect.get(opened, key);
    return typeof value === "function" ? value.bind(opened) : value;
  },
});
export { IDENT, SQLTYPE };
export const columnsOf = (table: string): Column[] => readColumns(db, table);
export const tableExists = (table: string) => typeof table === "string" && IDENT.test(table) && table !== "id" && !!db.prepare("SELECT 1 FROM _tables WHERE name=?").get(table);
export const labelCol = (table: string) => { const cols = columnsOf(table); return labelTextColumn(cols); };
export const rebuild = (table: string) => rebuildTable(db, table);
