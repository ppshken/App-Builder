import {externalTable} from './external-storage';
import {rowVersion} from "./row-version";
import {db} from './db';import {labelTextColumn,labelImageColumn,calculateRow,Column} from './columns';import {visibleRawRows,rowAllowed} from './row-access';import {expressionContext} from './expression-context';import {listPage} from './lists';type Row=Record<string,any>;
export type PreparedReadRow=ReturnType<typeof calculateRow>;
export function readRows(table: string, cols: Column[], now: Date, userEmail = "", context = expressionContext(now, userEmail), rawRows?: Row[],projection?:{allColumns:Column[]},prepared?:ReadonlyMap<number,PreparedReadRow>,deferVersion=false): Row[] {
  const readonly=externalTable(db,table);
  const metadata=projection?.allColumns||cols,label = labelTextColumn(metadata),image=labelImageColumn(metadata);
  const businessKey=metadata.find(c=>c.is_key);
  const listColumns=cols.filter(c=>c.type === "list" && c.ref_table);
  return visibleRawRows(table,rawRows ?? db.prepare(`SELECT * FROM "t_${table}"`).all() as Row[]).map(raw => {
    const prior=prepared?.get(Number(raw.id)),seed=prior?Object.fromEntries(cols.filter(c=>c.is_virtual&&Object.hasOwn(prior.row,c.name)).map(c=>[c.name,prior.row[c.name]])):undefined;
    const calculationColumns=seed?cols.map(c=>Object.hasOwn(seed,c.name)?{...c,is_virtual:0}:c):cols;
    const { row, errors } = calculateRow(calculationColumns, seed?{...raw,...seed}:raw, false, now, true, userEmail, context);
    if(prior)for(const [name,error]of Object.entries(prior.errors))if(cols.some(c=>c.name===name))errors[name]=error;
    for (const c of listColumns) {
      try { row[`${c.name}__labels`] = listPage(c.ref_table!,new URLSearchParams({limit:String(c.list_limit ?? 5)}),userEmail,row[c.name] || []).rows.map(r=>r.label); }
      catch(e) { errors[c.name]=(e as Error).message; }
    }
    return { ...row, ...(projection?{__partial:true}:deferVersion?{}:{__version:rowVersion(table,cols,raw)}), __permissions:{update:!readonly&&rowAllowed(table,raw,"update"),delete:!readonly&&rowAllowed(table,raw,"delete")}, __label: row[label] ?? raw.id, __image:image?row[image]??null:null, __key: businessKey ? row[businessKey.name] ?? null : null, ...(Object.keys(errors).length ? { __errors: errors } : {}) };
  });
}

export {withReferenceLabels} from "./reference-labels";
