import {applicationSql,currentApplication,applicationTable,APPLICATION_CONFIG_TABLES,assertApplicationSql} from './application-context';
import {AsyncLocalStorage} from "node:async_hooks";
import {installAuditing} from "./audit-schema";
﻿import Database from "better-sqlite3";
import { resolve } from "node:path";
import { labelTextColumn, IDENT, SQLTYPE, Column } from "./columns";
import { initializeDatabase, readColumns, rebuildTable } from "./schema";

export const databasePath = process.env.NOCODE_DB_PATH ? resolve(process.env.NOCODE_DB_PATH) : resolve("data.db");
const path = databasePath;
export function databaseGeneration(){return (globalThis as any).__nocodeDbGeneration || 0;}
export function markDatabaseRestored(){(globalThis as any).__nocodeDbGeneration = databaseGeneration()+1;}
const schemaVersion = "multi-application-runtime-v8-auto-number";
const g = globalThis as typeof globalThis & { __nocodeDb?: { path: string; db: Database.Database; version?: string } };
const scopeGlobal=globalThis as typeof globalThis & {__nocodeDatabaseScope?:AsyncLocalStorage<Database.Database>};
const databaseScope=scopeGlobal.__nocodeDatabaseScope??=new AsyncLocalStorage<Database.Database>();
export function withDatabase<T>(database:Database.Database,run:()=>T){return databaseScope.run(database,run);}
export function isIsolatedDatabase(){return !!databaseScope.getStore();}
function connection() {
  const isolated=databaseScope.getStore();if(isolated)return isolated;
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
export function platformDatabase(){return connection();}
export function applicationDatabase(database:Database.Database,id:string){return new Proxy(database,{get(target,key){if(key==='prepare'||key==='exec')return (sql:string)=>target[key](applicationSql(sql,id));if(key==='pragma')return (sql:string,options?:any)=>target.pragma(sql.replace(/(table_info|foreign_key_list|index_list)\((['"]?)(_[a-z_]+)\2\)/g,(all,op,q,name)=>APPLICATION_CONFIG_TABLES.includes(name as any)?op+"('"+applicationTable(id,name)+"')":all),options);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}
export const db = new Proxy({} as Database.Database, {
  get(_target, key) {
    const opened = connection();
    if(key==='prepare'||key==='exec')return (sql:string)=>{assertApplicationSql(sql);return opened[key](applicationSql(sql));};
    if(key==='pragma'&&currentApplication())return applicationDatabase(opened,currentApplication()!.id).pragma.bind(applicationDatabase(opened,currentApplication()!.id));
    const value = Reflect.get(opened, key);
    return typeof value === "function" ? value.bind(opened) : value;
  },
});
export { IDENT, SQLTYPE };
export const columnsOf = (table: string): Column[] => readColumns(db, table);
export const tableExists = (table: string) => typeof table === "string" && IDENT.test(table) && table !== "id" && (!currentApplication()?.datasets||!!currentApplication()!.datasets![table]?.read) && !!db.prepare("SELECT 1 FROM _tables WHERE name=?").get(table);
export const labelCol = (table: string) => { const cols = columnsOf(table); return labelTextColumn(cols); };
export const rebuild = (table: string) => rebuildTable(db, table);
