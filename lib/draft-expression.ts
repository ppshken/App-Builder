import {references,tableReferences,type ExpressionTable,type ExpressionContext} from "./expression";
import {calculateRow,formState,type Column} from "./columns";
export type DraftExpressionScope = {
  table:string;column:string;parentId:number|null;editingKey:string;
  records:{key:string;id?:number;deleted?:boolean;values:Record<string,any>}[];
};
// Pending records belong only to this open parent form. Negative IDs are local
// SELECT identities; they never enter the database or the submitted payload.
export function withDraftExpressionRows(tables:Record<string,ExpressionTable>,scope?:DraftExpressionScope):Record<string,ExpressionTable> {
  if(!scope || !tables[scope.table])return tables;
  const source=tables[scope.table],changedIds=new Set(scope.records.filter(r=>r.id!==undefined).map(r=>r.id));
  const rows=source.rows.filter(r=>!changedIds.has(Number(r.id)));
  scope.records.forEach((record,index)=>{
    if(record.deleted || record.key===scope.editingKey)return;
    const values={...record.values.__display,...record.values};
    rows.push({...Object.fromEntries(source.columns.map(name=>[name,values[name]??null])),id:record.id??-(index+1),[scope.column]:scope.parentId});
  });
  return {...tables,[scope.table]:{...source,rows}};
}

// Keep server-generated UNIQUEID/NOW values, but evaluate contextual defaults
// after parent links, initial values and pending siblings have been supplied.
export function contextualFormDefaults(columns:Column[],serverValues:Record<string,unknown>,supplied:Record<string,unknown>,now:Date,email:string,context:ExpressionContext) {
  const input={...serverValues,...supplied};
  for(const c of columns)if(!c.is_virtual && c.default_expr?.trim() && !Object.hasOwn(supplied,c.name) && (references(c.default_expr).length || tableReferences(c.default_expr).length))delete input[c.name];
  return {...input,...calculateRow(columns,input,true,now,false,email,context).row};
}
export function resetDependentRefChoices(columns:Column[],raw:Record<string,any>,changed:string,now:Date,email:string,context:ExpressionContext) {
  const next={...raw};
  function depends(source:string,target:string,seen=new Set<string>()):boolean {
    return references(source).some(name=>{if(name===target)return true;if(seen.has(name))return false;seen.add(name);const c=columns.find(c=>c.name===name);return !!(c?.is_virtual&&c.virtual_expr&&depends(c.virtual_expr,target,seen));});
  }
  // Recheck chains of dependent selectors until all remaining selections agree.
  const changedNames=new Set([changed]);
  for(let pass=0;pass<columns.length;pass++) {
    const state=formState(columns,next,now,email,context);let cleared=false;
    for(const c of columns)if(c.type==='ref'&&!c.is_virtual&&state.editable[c.name]&&c.name!==changed&&c.valid_if?.trim()&&!state.errors[c.name]&&[...changedNames].some(name=>depends(c.valid_if!,name))&&Object.hasOwn(state.choices,c.name)&&next[c.name]!=null&&next[c.name]!==''&&!state.choices[c.name].includes(String(next[c.name]))) {
      next[c.name]=null;changedNames.add(c.name);cleared=true;
    }
    if(!cleared)break;
  }
  return next;
}
