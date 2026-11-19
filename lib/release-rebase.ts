import type {ReleaseCatalog} from './release-plan';

type Row = Record<string, unknown>;
type Choice = 'live' | 'draft';
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeDraftSettings(base: ReleaseCatalog, live: ReleaseCatalog, draft: ReleaseCatalog, choices: Record<string, Choice> = {}) {
  const conflicts: {id: string; collection: string; label: string; field: string; live: unknown; draft: unknown}[] = [];
  const imported: {collection:string; label:string; field:string}[] = [];
  const merged: ReleaseCatalog = {};
  for (const collection of Object.keys(draft)) {
    const key = collection === '_table_overlays' ? 'table_name' : ['_columns','_app_settings'].includes(collection) ? 'id' : 'name';
    const index = (rows: Row[]) => new Map(rows.map(row => [String(row[key]), row]));
    const [before, current, edited] = [base, live, draft].map(c => index(c[collection] || []));
    merged[collection] = [];
    for (const id of new Set([...edited.keys(), ...current.keys(), ...before.keys()])) {
      const a = before.get(id), b = current.get(id), c = edited.get(id);
      function pick(field: string, original: unknown, actual: unknown, proposed: unknown): unknown {
        if (equal(actual, original) || equal(actual, proposed)) return proposed;
        if (equal(proposed, original)) {
          imported.push({collection,label:String(b?.label||a?.label||id),field});
          return actual;
        }
        const conflictId = JSON.stringify([collection, id, field]);
        const choice = Object.hasOwn(choices, conflictId) ? choices[conflictId] : undefined;
        if (choice === 'live') return actual;
        if (choice === 'draft') return proposed;
        conflicts.push({id: conflictId, collection, label: String(c?.label || b?.label || a?.label || id), field, live: actual, draft: proposed});
        return proposed;
      }
      const row = a && b && c
        ? Object.fromEntries(Object.keys(c).map(field => [field, pick(field, a[field], b[field], c[field])]))
        : pick('', a, b, c) as Row | undefined;
      if (row) merged[collection].push(row);
    }
  }
  return {merged, conflicts, imported};
}
