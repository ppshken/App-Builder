import type Database from "better-sqlite3";
import { assertIdentifier, Column, normalizeValue } from "./columns";
import { rewriteReferenceListLiterals } from "./expression";

// The caller owns the transaction and creates a backup before invoking this.
// Version 0 lists contain the selected business key; version 1 lists contain id.
export function migrateListReferences(db: Database.Database) {
  const version = db.prepare("SELECT list_reference_version AS version FROM _app_settings WHERE id=1").get() as {version:number};
  if (version.version === 1) return;
  if (version.version !== 0) throw Error("รูปแบบรหัสอ้างอิงใหม่กว่าระบบนี้ กรุณาอัปเดตแอปก่อน");
  const tables = db.prepare("SELECT name FROM _tables").all() as {name:string}[];
  const schemas = new Map<string, Column[]>();
  for (const {name} of tables) {
    assertIdentifier(name);
    const cols = db.prepare("SELECT * FROM _columns WHERE table_name=? ORDER BY pos,id").all(name) as Column[];
    for (const c of cols) { assertIdentifier(c.name); if (c.ref_table) assertIdentifier(c.ref_table); }
    schemas.set(name, cols);
  }
  for (const {name} of tables) for (const c of schemas.get(name)!.filter(c=>c.type==="list" && c.ref_table)) {
    const target = schemas.get(c.ref_table!);
    if (!target) throw Error(`List "${name} · ${c.label}" อ้างถึงตารางที่ไม่มีอยู่ กรุณาตรวจฐานข้อมูลเดิม`);
    const key = target.find(c=>c.is_key)?.name || "id";
    const values = db.prepare(`SELECT id,"${key}" AS value FROM "t_${c.ref_table}"`).all() as {id:number;value:unknown}[];
    const mapping = new Map<string,string>();
    for (const row of values) if (row.value != null) {
      const value = String(row.value);
      if (mapping.has(value)) throw Error(`รหัสในตาราง "${c.ref_table}" ซ้ำกัน กรุณาแก้ก่อนแปลง List`);
      mapping.set(value,String(row.id));
    }
    const convert = (raw:unknown) => (normalizeValue(c,raw) as string[]).map(value=>{
      const id = mapping.get(value);
      if (!id) throw Error(`แปลง List "${name} · ${c.label}" ไม่ได้: ไม่พบรหัส "${value}" ในตาราง "${c.ref_table}" ข้อมูลเดิมยังอยู่ กรุณาตรวจรหัสก่อน`);
      return id;
    });
    if (!c.is_virtual) {
      const update = db.prepare(`UPDATE "t_${name}" SET "${c.name}"=? WHERE id=?`);
      for (const row of db.prepare(`SELECT id,"${c.name}" AS value FROM "t_${name}"`).all() as {id:number;value:unknown}[]) {
        update.run(JSON.stringify([...new Set(convert(row.value))]),row.id);
      }
    }
    // Preserve conditional formulas and SELECT filters while changing only
    // literal List results that previously contained business keys.
    for (const field of ["default_expr","virtual_expr","valid_if"] as const) {
      const source = c[field];
      if (!source?.trim()) continue;
      const next = rewriteReferenceListLiterals(source,value=>convert([value])[0]);
      if (next !== source) db.prepare(`UPDATE _columns SET ${field}=? WHERE table_name=? AND name=?`).run(next,name,c.name);
    }
    if (!c.is_virtual) for (const action of db.prepare("SELECT name,values_json FROM _actions WHERE table_name=? AND kind='set'").all(name) as {name:string;values_json:string}[]) {
      const expressions=JSON.parse(action.values_json) as Record<string,string>;
      const source=expressions[c.name];
      if(!source)continue;
      const next=rewriteReferenceListLiterals(source,value=>convert([value])[0]);
      if(next!==source){expressions[c.name]=next;db.prepare("UPDATE _actions SET values_json=? WHERE name=?").run(JSON.stringify(expressions),action.name);}
    }
  }
  db.prepare("UPDATE _app_settings SET list_reference_version=1 WHERE id=1").run();
}

export function assertStoredListReferences(db:Database.Database) {
  const tables=db.prepare("SELECT name FROM _tables").all() as {name:string}[];
  const ids=new Map<string,Set<string>>();
  for(const {name} of tables) {
    assertIdentifier(name);
    const cols=db.prepare("SELECT * FROM _columns WHERE table_name=? AND type='list' AND is_virtual=0 AND ref_table IS NOT NULL AND ref_table!=''").all(name) as Column[];
    for(const c of cols) {
      assertIdentifier(c.name);assertIdentifier(c.ref_table);
      if(!ids.has(c.ref_table!))ids.set(c.ref_table!,new Set((db.prepare(`SELECT id FROM "t_${c.ref_table}"`).all() as {id:number}[]).map(r=>String(r.id))));
      for(const row of db.prepare(`SELECT id,"${c.name}" AS value FROM "t_${name}"`).iterate() as Iterable<{id:number;value:unknown}>) {
        const values=normalizeValue(c,row.value) as string[];
        if(values.some(value=>!ids.get(c.ref_table!)!.has(value)))throw Error(`List "${name} · ${c.label}" แถว ${row.id} อ้างถึงรหัสภายในที่ไม่มีอยู่ กรุณาตรวจไฟล์สำรอง`);
      }
    }
  }
}
