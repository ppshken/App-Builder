import {imageFolder} from "./media-settings";
import {AUTH_SCHEMA,migrateAuthRoles} from "./auth-schema";
import type Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {assertUniqueColumn,assertUniqueData,uniqueNonBlankSql} from "./unique";
import { assertLabels, assertIdentifier, Column, FORMULA_FIELDS, SQLTYPE } from "./columns";
import { migrateListReferences } from "./list-reference-migration";

export function readColumns(db: Database.Database, table: string): Column[] {
  assertIdentifier(table);
  const cols = db.prepare("SELECT * FROM _columns WHERE table_name=? ORDER BY pos,id").all(table) as Column[];
  for (const c of cols) {
    assertIdentifier(c.name);if(c.gps_auto!==undefined&&![0,1].includes(Number(c.gps_auto)))throw Error("การตั้งค่า GPS ไม่ถูกต้อง");if(c.gps_auto&&(c.type!=="latlong"||c.is_virtual))throw Error("ตำแหน่งปัจจุบันต้องเป็นช่องพิกัดข้อมูลจริง");if(c.image_path)imageFolder(c.image_path);
    assertUniqueColumn(c);
    if (!Object.hasOwn(SQLTYPE, c.type)) throw new Error(`ชนิดข้อมูลของ "${c.label}" ไม่รองรับ`);
    if (c.type === "ref" || (c.type === "list" && c.ref_table)) assertIdentifier(c.ref_table);
  }
  assertLabels(cols);
  return cols;
}
export function columnDefinition(c: Column) {
  assertIdentifier(c.name);
  if (!Object.hasOwn(SQLTYPE, c.type)) throw new Error("ชนิดข้อมูลไม่รองรับ");
  if (c.type === "ref") assertIdentifier(c.ref_table);
  return `"${c.name}" ${SQLTYPE[c.type]}` + (c.type === "ref" ? ` REFERENCES "t_${c.ref_table}"(id)` : "");
}
// Called with foreign_keys OFF, inside a transaction; keeps row IDs and AUTOINCREMENT history.
export function rebuildTable(db: Database.Database, table: string) {
  assertIdentifier(table);
  const cols = readColumns(db, table).filter(c => !c.is_virtual);
  const seq = (db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(`t_${table}`) as { seq: number } | undefined)?.seq ?? 0;
  const names = ["id", ...cols.map(c => c.name)].map(n => `"${n}"`).join(",");
  const defs = ["id INTEGER PRIMARY KEY AUTOINCREMENT", ...cols.map(columnDefinition)];
  db.prepare(`CREATE TABLE "t_${table}__new"(${defs.join(",")})`).run();
  db.prepare(`INSERT INTO "t_${table}__new"(${names}) SELECT ${names} FROM "t_${table}"`).run();
  db.prepare(`DROP TABLE "t_${table}"`).run();
  db.prepare(`ALTER TABLE "t_${table}__new" RENAME TO "t_${table}"`).run();
  const current = db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(`t_${table}`);
  if (current) db.prepare("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?").run(seq, `t_${table}`);
  else db.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)").run(`t_${table}`, seq);
  syncKeyIndex(db, table);
}
export function syncKeyIndex(db: Database.Database, table: string) {
  const cols = readColumns(db, table), key = cols.find(c => c.is_key);
  assertUniqueData(db,table,cols);
  const ownPattern=new RegExp("^_unique_"+table+"_[a-z][a-z0-9_]{0,40}$");
  for(const index of db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?").all(`t_${table}`) as {name:string}[])if(ownPattern.test(index.name))db.prepare(`DROP INDEX "${index.name}"`).run();
  for(const c of cols.filter(c=>c.is_unique&&!c.is_key))db.prepare(`CREATE UNIQUE INDEX "_unique_${table}_${c.name}" ON "t_${table}"("${c.name}") WHERE ${uniqueNonBlankSql(c.name)}`).run();
  db.prepare(`DROP INDEX IF EXISTS "_key_${table}"`).run();
  if (key) db.prepare(`CREATE UNIQUE INDEX "_key_${table}" ON "t_${table}"("${key.name}")`).run();
  for (const c of cols.filter(c => c.type === "ref" && !c.is_virtual)) db.prepare(`CREATE INDEX IF NOT EXISTS "_ref_${table}_${c.name}" ON "t_${table}"("${c.name}")`).run();
}
export function createDefaultViews(db: Database.Database, table: string, label: string) {
  for (const [kind, position, suffix] of [["list", "primary", ""], ["detail", "ref", " · รายละเอียด"], ["form", "ref", " · ฟอร์ม"]]) {
    let i = 1; while (db.prepare("SELECT 1 FROM _views WHERE name=?").get(`view_${i}`)) i++;
    db.prepare("INSERT INTO _views(name,label,table_name,kind,position,pos) VALUES(?,?,?,?,?,?)").run(`view_${i}`, label + suffix, table, kind, position, i);
  }
  createInlineViews(db,table);
}
export function createInlineViews(db: Database.Database, table: string) {
  // During the oldest migration inline_ref has not been added yet.
  if(!(db.pragma("table_info('_views')") as {name:string}[]).some(c=>c.name==="inline_ref")) return;
  const label=(db.prepare("SELECT label FROM _tables WHERE name=?").get(table) as {label:string}).label;
  for(const c of readColumns(db,table).filter(c=>c.type==="ref" && !c.is_virtual)) {
    if(db.prepare("SELECT 1 FROM _views WHERE table_name=? AND position='inline' AND inline_ref=?").get(table,c.name))continue;
    let i=1;while(db.prepare("SELECT 1 FROM _views WHERE name=?").get(`view_${i}`))i++;
    db.prepare("INSERT INTO _views(name,label,table_name,kind,position,pos,inline_ref,sort_dir,display_json) VALUES(?,?,?,'list','inline',?,?,'asc',?)").run(`view_${i}`,`${label} · Inline (${c.label})`,table,i,c.name,JSON.stringify({image_column:"",summary_columns:[],list_buttons:"none"}));
  }
}
export function foreignKeyTransaction(db: Database.Database, work: () => void) {
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      work();
      if ((db.pragma("foreign_key_check") as unknown[]).length) throw new Error("โครงสร้างใหม่ทำให้ข้อมูลอ้างอิงไม่ถูกต้อง ยกเลิกการเปลี่ยนแปลงแล้ว");
    })();
  } finally { db.pragma("foreign_keys = ON"); }
}
export function initializeDatabase(db: Database.Database, path: string) {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _tables(name TEXT PRIMARY KEY,label TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS _columns(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,
      name TEXT NOT NULL,label TEXT NOT NULL,type TEXT NOT NULL,
      options TEXT,ref_table TEXT,required INTEGER DEFAULT 0,pos INTEGER DEFAULT 0,
      UNIQUE(table_name,name));
  `);
  const existing = new Set((db.pragma("table_info('_columns')") as { name: string }[]).map(c => c.name));
  const missing = ["is_virtual", ...FORMULA_FIELDS, "is_key", "is_label", "list_limit", "is_editable", "is_unique", "image_path", "gps_auto"].filter(name => !existing.has(name));
  const needRowRules=!db.prepare("SELECT 1 FROM sqlite_master WHERE name='_role_row_rules'").get();
  const actionFields=new Set((db.pragma("table_info('_actions')") as {name:string}[]).map(c=>c.name));
  const needActionConfig=!actionFields.has("config_json");
  const needUserSettings=!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_user_setting_defs'").get();
  const needRoles=!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_roles'").get();
  const needAuth = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_users'").get();
  const needViews = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_views'").get();
  const needFeatures = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_slices'").get();
  const needSliceSource = needViews || !(db.pragma("table_info('_views')") as { name: string }[]).some(c => c.name === "slice_name");
  const viewFields = new Set((db.pragma("table_info('_views')") as { name: string }[]).map(c => c.name));
  const missingViewOptions = ["icon", "group_column", "group_dir"].filter(name => !viewFields.has(name));
  const needVisibility = !viewFields.has("show_if");
  const needDisplay = !viewFields.has("display_json");
  const needInline = !viewFields.has("inline_ref");
  const needImages = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_images'").get();
  const needImagePath=!(db.pragma("table_info('_images')") as {name:string}[]).some(c=>c.name==="storage_path");
  const needSettings = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_app_settings'").get();
  const settingsFields = new Set((db.pragma("table_info('_app_settings')") as {name:string}[]).map(c=>c.name));
  const settingsOptions = {icon_image:"TEXT NOT NULL DEFAULT ''",home_view:"TEXT NOT NULL DEFAULT ''",image_max_edge:"INTEGER NOT NULL DEFAULT 0",image_quality:"INTEGER NOT NULL DEFAULT 85",image_format:"TEXT NOT NULL DEFAULT 'original'",image_max_mb:"REAL NOT NULL DEFAULT 5",image_storage:"TEXT NOT NULL DEFAULT 'database'",image_folder:"TEXT NOT NULL DEFAULT 'images'", display_defaults_json:"TEXT NOT NULL DEFAULT '{}'", font:"TEXT NOT NULL DEFAULT 'sarabun'", font_size:"INTEGER NOT NULL DEFAULT 14", loading_style:"TEXT NOT NULL DEFAULT 'text'", loading_text:"TEXT NOT NULL DEFAULT 'กำลังโหลด…'", custom_color:"TEXT NOT NULL DEFAULT '#2563EB'", list_reference_version:"INTEGER NOT NULL DEFAULT 0" };
  const missingSettingsOptions = Object.entries(settingsOptions).filter(([name])=>!settingsFields.has(name));
  const needListReferences = !settingsFields.has("list_reference_version") || (db.prepare("SELECT list_reference_version AS version FROM _app_settings WHERE id=1").get() as {version:number} | undefined)?.version !== 1;
  const tables = db.prepare("SELECT name FROM _tables").all() as { name: string }[];
  const rebuild: string[] = [];
  for (const { name } of tables) {
    assertIdentifier(name); readColumns(db, name);
    if ((db.pragma(`table_info('t_${name}')`) as { notnull: number; pk: number }[]).some(c => c.notnull && !c.pk)) rebuild.push(name);
  }
  if (needImagePath || needRowRules || needActionConfig || needUserSettings || needRoles || needAuth || missing.length || rebuild.length || needViews || needFeatures || needSliceSource || needSettings || needImages || missingViewOptions.length || needDisplay || needVisibility || needInline || missingSettingsOptions.length || needListReferences) {
    // VACUUM INTO captures a consistent database including WAL; retained on migration failure.
    if ((tables.length || !needSettings) && path !== ":memory:") {
      const folder = join(dirname(path), "backups");
      mkdirSync(folder, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      db.prepare("VACUUM INTO ?").run(join(folder, `data.before-${needRowRules && !needRoles && !needAuth ? "row-permissions-actions" : needUserSettings && !needRoles && !needAuth ? "user-settings" : needRoles && !needAuth && !missing.length && !missingSettingsOptions.length ? "permissions" : needAuth && !missing.length && !needViews && !needFeatures && !needSettings && !missingSettingsOptions.length ? "authentication" : needListReferences && !missing.length && !needSettings && missingSettingsOptions.every(([name])=>name==="list_reference_version") ? "list-reference-ids" : missing.includes("gps_auto") ? "locations" : missing.includes("virtual_expr") ? "expressions" : missing.includes("is_editable") ? "editable-columns" : missing.includes("is_unique") ? "unique-columns" : missing.includes("list_limit") ? "related-lists" : needFeatures ? "slices-actions" : needViews || missing.length ? "views" : needSettings ? "app-settings" : needImages ? "images" : missingViewOptions.length ? "view-options" : needVisibility ? "view-visibility" : needDisplay ? "view-display" : needInline ? "inline-views" : missingSettingsOptions.some(([name])=>name==="display_defaults_json") ? "display-defaults" : "app-appearance"}-${stamp}.db`));
    }
    foreignKeyTransaction(db, () => {
      if (needAuth || needUserSettings || needRowRules) db.exec(AUTH_SCHEMA);
      if (needRoles) migrateAuthRoles(db);
      for (const name of missing) db.prepare(`ALTER TABLE _columns ADD COLUMN ${name} ${["is_unique","gps_auto"].includes(name) ? "INTEGER NOT NULL DEFAULT 0" : name === "is_editable" ? "INTEGER NOT NULL DEFAULT 1" : name === "list_limit" ? "INTEGER NOT NULL DEFAULT 5" : ["is_virtual", "is_key", "is_label"].includes(name) ? "INTEGER NOT NULL DEFAULT 0" : "TEXT"}`).run();
      if (needViews) {
        db.exec(`CREATE TABLE _views(name TEXT PRIMARY KEY,label TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,kind TEXT NOT NULL,position TEXT NOT NULL,pos INTEGER NOT NULL DEFAULT 0,columns_json TEXT NOT NULL DEFAULT '[]',sort_column TEXT NOT NULL DEFAULT 'id',sort_dir TEXT NOT NULL DEFAULT 'desc');`);
        for (const t of tables) {
          const label = (db.prepare("SELECT label FROM _tables WHERE name=?").get(t.name) as { label: string }).label;
          createDefaultViews(db, t.name, label);
        }
      }
      db.exec(`CREATE TABLE IF NOT EXISTS _slices(name TEXT PRIMARY KEY,label TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,filter_expr TEXT NOT NULL DEFAULT 'TRUE',columns_json TEXT NOT NULL DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS _actions(name TEXT PRIMARY KEY,label TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,kind TEXT NOT NULL,condition_expr TEXT NOT NULL DEFAULT 'TRUE',values_json TEXT NOT NULL DEFAULT '{}',confirmation TEXT NOT NULL DEFAULT '');`);
      if(needActionConfig){db.exec("ALTER TABLE _actions ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}'; ALTER TABLE _actions ADD COLUMN appearance_json TEXT NOT NULL DEFAULT '{}'");}
      for (const name of missingViewOptions) db.prepare(`ALTER TABLE _views ADD COLUMN ${name} TEXT NOT NULL DEFAULT '${name === "group_dir" ? "asc" : ""}'`).run();
      if (needVisibility) db.exec("ALTER TABLE _views ADD COLUMN show_if TEXT NOT NULL DEFAULT ''");
      if (needDisplay) db.exec("ALTER TABLE _views ADD COLUMN display_json TEXT NOT NULL DEFAULT '{}'");
      if (needInline) db.exec("ALTER TABLE _views ADD COLUMN inline_ref TEXT NOT NULL DEFAULT ''");
      if (needSliceSource) db.exec("ALTER TABLE _views ADD COLUMN slice_name TEXT REFERENCES _slices(name)");
      if (needSettings) db.exec(`CREATE TABLE _app_settings(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,icon TEXT NOT NULL,color TEXT NOT NULL,mode TEXT NOT NULL);
        INSERT INTO _app_settings VALUES(1,'No-code Builder','grid','blue','auto');`);
      for (const [name,definition] of missingSettingsOptions) db.prepare(`ALTER TABLE _app_settings ADD COLUMN ${name} ${definition}`).run();
      if (needImages) db.exec("CREATE TABLE _images(id TEXT PRIMARY KEY,mime TEXT NOT NULL,data BLOB NOT NULL)");
      if(needImagePath)db.exec("ALTER TABLE _images ADD COLUMN storage_path TEXT NOT NULL DEFAULT ''");
      for (const name of rebuild) rebuildTable(db, name);
      for (const {name} of tables) syncKeyIndex(db, name);
      if(needInline) for(const {name} of tables) createInlineViews(db,name);
      if (needListReferences) migrateListReferences(db);
    });
  }
  db.pragma("journal_mode = WAL");
}
