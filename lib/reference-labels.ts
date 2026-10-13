import {db, columnsOf, tableExists} from "./db";
import {labelTextColumn, labelImageColumn, calculateRow, type Column} from "./columns";
import {visibleRawRows} from "./row-access";
import {expressionContext} from "./expression-context";
import {canRead} from "./permissions";
import {references} from "./expression";
type Row = Record<string, any>;

function referenceLabelColumns(cols: Column[], names: string[]): Column[] {
  const needed = new Set(names), queue = [...names], byName = new Map(cols.map(c => [c.name, c]));
  for (let i = 0; i < queue.length; i++) {
    const c = byName.get(queue[i]);
    if (!c?.is_virtual || !c.virtual_expr?.trim()) continue;
    // Invalid formulas retain calculateRow's tolerant null/fallback behavior.
    try {
      for (const name of references(c.virtual_expr)) if (!needed.has(name)) {
        needed.add(name); queue.push(name);
      }
    } catch {}
  }
  return cols.filter(c => needed.has(c.name));
}

export function loadReferenceLabels(cols: Column[], rows: Row[], now: Date, email: string, context = expressionContext(now, email)) {
  const result = new Map<string, Map<number, {label: unknown; image: unknown}>>();
  const targets = new Map<string, Column[]>();
  for (const c of cols) if (c.type === "ref" && canRead(c.ref_table!)) {
    const refs = targets.get(c.ref_table!) || [];
    refs.push(c); targets.set(c.ref_table!, refs);
  }
  for (const [target, refs] of targets) {
    if (!tableExists(target)) throw new Error(`ไม่พบตารางอ้างอิงของ "${refs[0].label}"`);
    const ids = [...new Set(rows.flatMap(row => refs.map(c => row[c.name])).filter(id => id != null))];
    const labels = new Map<number, {label: unknown; image: unknown}>();
    if (ids.length) {
      const targetCols = columnsOf(target), label = labelTextColumn(targetCols), image = labelImageColumn(targetCols);
      const selected = referenceLabelColumns(targetCols, [label, ...(image ? [image] : [])]);
      // Read each target once per batch, including full raw rows for row policies.
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const raw = db.prepare(`SELECT * FROM "t_${target}" WHERE id IN (${batch.map(() => "?").join(",")})`).all(...batch) as Row[];
        for (const record of visibleRawRows(target, raw)) {
          const {row} = calculateRow(selected, record, false, now, true, email, context);
          labels.set(record.id, {label: row[label], image: image ? row[image] ?? null : null});
        }
      }
    }
    result.set(target, labels);
  }
  return result;
}

export function withReferenceLabels(table: string, cols: Column[], rows: Row[], now: Date, email: string, context = expressionContext(now, email)) {
  const labels = loadReferenceLabels(cols, rows, now, email, context);
  for (const c of cols) {
    const target = labels.get(c.ref_table!);
    if (c.type !== "ref" || !target) continue;
    for (const row of rows) {
      const value = target.get(row[c.name]);
      row[`${c.name}__label`] = value ? value.label ?? row[c.name] : null;
      row[`${c.name}__image`] = value?.image ?? null;
    }
  }
  return rows;
}
