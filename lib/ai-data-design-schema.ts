import { currentApplication } from "./application-context";
import { columnsOf, db, tableExists } from "./db";
import { canRead } from "./permissions";

export function dataDesignSchema(included?: ReadonlySet<string>) {
  const rows = db.prepare("SELECT name,owner_app_id,source_kind FROM _tables").all() as {
    name: string; owner_app_id: string; source_kind: string;
  }[];
  const existing = new Set(rows.map(row => row.name));
  const visible = new Set<string>();
  const editable = new Map<string, Set<string>>();
  for (const row of rows) {
    if (included && !included.has(row.name) || row.source_kind === "EXTERNAL_REST_API" || !tableExists(row.name) || !canRead(row.name)) continue;
    visible.add(row.name);
    if (row.owner_app_id === currentApplication()?.id)
      editable.set(row.name, new Set(columnsOf(row.name).map(column => column.name)));
  }
  return { existing, visible, editable };
}
