import type Database from "better-sqlite3";
import { assertIdentifier, Column, normalizeValue } from "./columns";
import { listSource } from "./expression";

// SELECT-backed EnumList stores business values. Keep its saved selections in
// sync too, after updating the source row inside the same transaction.
export function cascadeEnumListValues(db: Database.Database, table:string, cols:Column[], before:Record<string,unknown>, after:Record<string,unknown>) {
  assertIdentifier(table);
  const changed = cols.filter(c=>!c.is_virtual && before[c.name]!=null && after[c.name]!=null && String(before[c.name])!==String(after[c.name]));
  if (!changed.length) return;
  const tables = db.prepare("SELECT name FROM _tables").all() as {name:string}[];
  for (const owner of tables) {
    assertIdentifier(owner.name);
    const targets = db.prepare("SELECT * FROM _columns WHERE table_name=? AND type='enumlist' AND is_virtual=0").all(owner.name) as Column[];
    for (const target of targets) {
      assertIdentifier(target.name);
      if (!target.valid_if?.trim()) continue;
      const source = listSource(target.valid_if);
      const column = source?.table===table ? changed.find(c=>c.name===source.column) : undefined;
      if (!column) continue;
      const oldValue=String(before[column.name]),newValue=String(after[column.name]);
      // Do not redirect non-Key selections while another row has the old value.
      if (db.prepare(`SELECT 1 FROM "t_${table}" WHERE CAST("${column.name}" AS TEXT)=? LIMIT 1`).get(oldValue)) continue;
      const rows=db.prepare(`SELECT id,"${target.name}" AS value FROM "t_${owner.name}" WHERE EXISTS(SELECT 1 FROM json_each("${target.name}") WHERE CAST(value AS TEXT)=?)`).all(oldValue) as {id:number;value:unknown}[];
      const update=db.prepare(`UPDATE "t_${owner.name}" SET "${target.name}"=? WHERE id=?`);
      for (const row of rows) {
        const selected=normalizeValue(target,row.value) as string[];
        update.run(JSON.stringify([...new Set(selected.map(v=>v===oldValue?newValue:v))]),row.id);
      }
    }
  }
}
