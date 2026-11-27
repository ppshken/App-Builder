import type { Column } from "./columns";

type Named = { name: string; label: string };
export function aiRelationships(tables: readonly {name:string;columns:readonly Column[]}[], visible: ReadonlySet<string>) {
  return tables.flatMap(table => table.columns.filter(column =>
    column.type === "ref" && !column.is_virtual && !!column.ref_table && visible.has(column.ref_table))
    .map(column => ({childTable:table.name,refColumn:column.name,parentTable:column.ref_table!,
      sameParentRefCount:table.columns.filter(other => other.type === "ref" && !other.is_virtual &&
        other.ref_table === column.ref_table).length}))).slice(0,200);
}
export function ambiguousAiNames(value: unknown, options: readonly Named[]): Named[] {
  if (typeof value !== "string" || !value.trim() || resolveAiName(value, options)) return [];
  const query = value.normalize("NFKC").trim().toLowerCase();
  return options.filter(item => item.label.normalize("NFKC").trim().toLowerCase() === query);
}
export function resolveAiName(value: unknown, options: readonly Named[]): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalize = (name: string) => name.normalize("NFKC").trim().toLowerCase();
  const query = normalize(value);
  const exact = options.find(item => normalize(item.name) === query);
  if (exact) return exact.name;
  const labels = options.filter(item => normalize(item.label) === query);
  return labels.length === 1 ? labels[0].name : undefined;
}
export type AiContextCoverage = {
  tablesIncluded: number;
  tablesAvailable: number;
  columnsIncluded: number;
  columnsAvailableInSelectedTables: number;
};

export function aiContextTerms(question: string, expression = "", history = ""): (item: Named) => number {
  const text = (question + "\n" + expression).normalize("NFKC").toLowerCase();
  const identifiers = new Set(text.match(/[a-z0-9_]+/g));
  const historicTerms = history ? aiContextTerms(history) : undefined;
  return (item: Named) => {
    if (identifiers.has(item.name.toLowerCase())) return 2;
    const label = item.label.normalize("NFKC").trim().toLowerCase();
    if (label && (/^[a-z0-9_]+$/.test(label) ? identifiers.has(label) : text.includes(label))) return 1;
    return historicTerms?.(item) ? 0.5 : 0;
  };
}

export function selectAiContext(
  catalogue: readonly Named[],
  loadColumns: (table: string) => Column[],
  mentions: (item: Named) => number,
  target?: {table: string; column: string},
) {
  const loaded = new Map<string, Column[]>();
  const load = (table: string) => {
    let columns = loaded.get(table);
    if (!columns) {
      columns = loadColumns(table);
      loaded.set(table, columns);
    }
    return columns;
  };
  const primary = [...catalogue].sort((a,b) =>
    Number(b.name === target?.table) - Number(a.name === target?.table) || mentions(b) - mentions(a));
  const refs = new Set<string>();
  for (const item of primary.slice(0,20)) {
    if (item.name !== target?.table && !mentions(item)) break;
    for (const column of load(item.name)) {
      if (column.ref_table && (mentions(column) || item.name === target?.table || mentions(item) >= 2))
        refs.add(column.ref_table);
    }
  }
  const namedParents = new Set(primary.filter(item => item.name === target?.table || mentions(item) >= 2).map(item => item.name));
  // Bound discovery to avoid scanning every column in very large applications.
  if (namedParents.size) {
    for (const item of primary.slice(0,100)) {
      if (namedParents.has(item.name)) continue;
      if (load(item.name).some(column => column.type === "ref" && !column.is_virtual &&
          !!column.ref_table && namedParents.has(column.ref_table))) refs.add(item.name);
    }
  }
  const tables = primary.sort((a,b) =>
    Number(b.name === target?.table) - Number(a.name === target?.table) || mentions(b) - mentions(a) ||
    Number(refs.has(b.name)) - Number(refs.has(a.name))).slice(0,20).map(item => {
      const columns = load(item.name);
      const rank = (column: Column) => (item.name === target?.table && column.name === target.column ? 20 : 0) +
        mentions(column) * 4 + Number(!!column.is_key || !!column.is_label);
      const columnLimit = !target && mentions(item) >= 2 ? 100 : 30;
      return {...item, columns, selectedColumns:[...columns].sort((a,b) => rank(b)-rank(a)).slice(0,columnLimit)};
    });
  const coverage: AiContextCoverage = {
    tablesIncluded:tables.length, tablesAvailable:catalogue.length,
    columnsIncluded:tables.reduce((total,table) => total + table.selectedColumns.length,0),
    columnsAvailableInSelectedTables:tables.reduce((total,table) => total + table.columns.length,0),
  };
  return {tables, coverage};
}
