import {externalTable} from './external-storage';
import {rowVersion} from "./row-version";
import {db} from './db';import {labelTextColumn,labelImageColumn,calculateRow,Column} from './columns';import {visibleRawRows,rowAllowed} from './row-access';import {expressionContext} from './expression-context';import {listPage} from './lists';type Row=Record<string,any>;
export function readRows(table: string, cols: Column[], now: Date, userEmail = "", context = expressionContext(now, userEmail), rawRows?: Row[]): Row[] {
  const readonly=externalTable(db,table);
  const label = labelTextColumn(cols),image=labelImageColumn(cols);
  return visibleRawRows(table,rawRows ?? db.prepare(`SELECT * FROM "t_${table}"`).all() as Row[]).map(raw => {
    const { row, errors } = calculateRow(cols, raw, false, now, true, userEmail, context);
    for (const c of cols.filter(c=>c.type === "list" && c.ref_table)) {
      try { row[`${c.name}__labels`] = listPage(c.ref_table!,new URLSearchParams({limit:String(c.list_limit ?? 5)}),userEmail,row[c.name] || []).rows.map(r=>r.label); }
      catch(e) { errors[c.name]=(e as Error).message; }
    }
    const businessKey=cols.find(c=>c.is_key);
    return { ...row, __version:rowVersion(table,cols,raw), __permissions:{update:!readonly&&rowAllowed(table,raw,"update"),delete:!readonly&&rowAllowed(table,raw,"delete")}, __label: row[label] ?? raw.id, __image:image?row[image]??null:null, __key: businessKey ? row[businessKey.name] ?? null : null, ...(Object.keys(errors).length ? { __errors: errors } : {}) };
  });
}

export {withReferenceLabels} from "./reference-labels";
