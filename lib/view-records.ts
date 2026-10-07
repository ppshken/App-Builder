import {db,columnsOf,labelCol} from './db';import {labelImageColumn,calculateRow,Column} from './columns';import {visibleRawRows,rowAllowed} from './row-access';import {expressionContext} from './expression-context';import {listPage} from './lists';import {canRead} from './permissions';type Row=Record<string,any>;
export function readRows(table: string, cols: Column[], now: Date, userEmail = "", context = expressionContext(now, userEmail), rawRows?: Row[]): Row[] {
  const label = labelCol(table),image=labelImageColumn(cols);
  return visibleRawRows(table,rawRows ?? db.prepare(`SELECT * FROM "t_${table}"`).all() as Row[]).map(raw => {
    const { row, errors } = calculateRow(cols, raw, false, now, true, userEmail, context);
    for (const c of cols.filter(c=>c.type === "list" && c.ref_table)) {
      try { row[`${c.name}__labels`] = listPage(c.ref_table!,new URLSearchParams({limit:String(c.list_limit ?? 5)}),userEmail,row[c.name] || []).rows.map(r=>r.label); }
      catch(e) { errors[c.name]=(e as Error).message; }
    }
    const businessKey=cols.find(c=>c.is_key);
    return { ...row, __permissions:{update:rowAllowed(table,raw,"update"),delete:rowAllowed(table,raw,"delete")}, __label: row[label] ?? raw.id, __image:image?row[image]??null:null, __key: businessKey ? row[businessKey.name] ?? null : null, ...(Object.keys(errors).length ? { __errors: errors } : {}) };
  });
}

export function withReferenceLabels(table:string,cols:Column[],rows:Row[],now:Date,email:string,context=expressionContext(now,email)){for(const c of cols.filter(c=>c.type==='ref'&&canRead(c.ref_table!))){const ids=[...new Set(rows.map(r=>r[c.name]).filter(x=>x!=null))],raw:Row[]=[];for(let i=0;i<ids.length;i+=500){const batch=ids.slice(i,i+500);raw.push(...db.prepare('SELECT * FROM "t_'+c.ref_table+'" WHERE id IN ('+batch.map(()=>'?').join(',')+')').all(...batch) as Row[]);}const labels=new Map(readRows(c.ref_table!,columnsOf(c.ref_table!),now,email,context,raw).map(r=>[r.id,{label:r.__label,image:r.__image}]));for(const row of rows){row[c.name+'__label']=labels.get(row[c.name])?.label??null;row[c.name+'__image']=labels.get(row[c.name])?.image??null;}}return rows;}
