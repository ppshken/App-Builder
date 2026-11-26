import type { Column } from "./columns";

type Named = { name: string; label: string };
export type AiContextCoverage = {
  tablesIncluded: number;
  tablesAvailable: number;
  columnsIncluded: number;
  columnsAvailableInSelectedTables: number;
};

export function aiContextTerms(question: string, expression = "") {
  const text = (question + "\n" + expression).normalize("NFKC").toLowerCase();
  const identifiers = new Set(text.match(/[a-z0-9_]+/g));
  return (item: Named) => {
    if (identifiers.has(item.name.toLowerCase())) return 2;
    const label = item.label.normalize("NFKC").trim().toLowerCase();
    if (label && (/^[a-z0-9_]+$/.test(label) ? identifiers.has(label) : text.includes(label))) return 1;
    return 0;
  };
}

export function selectAiContext(
  catalogue: readonly Named[],
  loadColumns: (table: string) => Column[],
  mentions: ReturnType<typeof aiContextTerms>,
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
      if (column.ref_table && (mentions(column) || item.name === target?.table))
        refs.add(column.ref_table);
    }
  }
  const tables = primary.sort((a,b) =>
    Number(b.name === target?.table) - Number(a.name === target?.table) || mentions(b) - mentions(a) ||
    Number(refs.has(b.name)) - Number(refs.has(a.name))).slice(0,20).map(item => {
      const columns = load(item.name);
      const rank = (column: Column) => (item.name === target?.table && column.name === target.column ? 20 : 0) +
        mentions(column) * 4 + Number(!!column.is_key || !!column.is_label);
      return {...item, columns, selectedColumns:[...columns].sort((a,b) => rank(b)-rank(a)).slice(0,30)};
    });
  const coverage: AiContextCoverage = {
    tablesIncluded:tables.length, tablesAvailable:catalogue.length,
    columnsIncluded:tables.reduce((total,table) => total + table.selectedColumns.length,0),
    columnsAvailableInSelectedTables:tables.reduce((total,table) => total + table.columns.length,0),
  };
  return {tables, coverage};
}
