import type {Column} from "./columns";
import type {FormulaTable} from "./formula-completion";

export type RelatedFormulaSource = {
  table: string; label: string; refColumn: string; refLabel: string;
  alias: string; expression: string; columns: Column[];
};

export function relatedFormulaSources(columns: Column[], tables: FormulaTable[], ownerTable?: string): RelatedFormulaSource[] {
  const parent = ownerTable || columns.find(c=>c.table_name)?.table_name || tables.find(t=>t.columns===columns)?.name;
  if (!parent) return [];
  return tables.flatMap(table => {
    const links = (table.columns || []).filter(c=>c.type==="ref"&&!c.is_virtual&&c.ref_table===parent);
    return links.map(link => {
      const alias = `Related_${table.name}${links.length>1?":"+link.name:""}`;
      return {table:table.name,label:table.label||table.name,refColumn:link.name,refLabel:link.label||link.name,alias,expression:`[${alias}]`,
        columns:[{name:"id",label:"รหัสแถว",type:"number"},...(table.columns||[]).filter(c=>c.name!=="id"&&!["list","enumlist"].includes(c.type))]};
    });
  });
}
