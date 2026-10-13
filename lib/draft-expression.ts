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
  const byName=new Map(columns.map(c=>[c.name,c])), parsed=new Map<string,string[]>();
  function refs(source:string) {
    if(!parsed.has(source)) {
      try { parsed.set(source,references(source)); }
      catch { parsed.set(source,[]); } // Invalid field formulas are reported by formState.
    }
    return parsed.get(source)!;
  }
  const candidates=columns.filter(c=>c.type==='ref'&&!c.is_virtual&&c.is_editable!==0&&c.is_editable!==false&&c.name!==changed&&c.valid_if?.trim()&&next[c.name]!=null&&next[c.name]!=='');
  const dependencies=new Map(candidates.map(c=>{
    const needed=new Set(refs(c.valid_if!));
    for(const name of needed){const dependency=byName.get(name);if(dependency?.is_virtual&&dependency.virtual_expr)for(const ref of refs(dependency.virtual_expr))needed.add(ref);}
    return [c.name,needed] as const;
  }));
  const intersects=(c:Column,names:Set<string>)=>[...dependencies.get(c.name)!].some(name=>names.has(name));
  // Include downstream selectors that may be invalidated by a cleared Ref.
  const affected=new Set([changed]);
  for(let pass=0;pass<candidates.length;pass++) {
    let added=false;
    for(const c of candidates)if(!affected.has(c.name)&&intersects(c,affected)){affected.add(c.name);added=true;}
    if(!added)break;
  }
  const relevant=candidates.filter(c=>affected.has(c.name));
  if(!relevant.length)return next;
  // Recheck chains of dependent selectors until all remaining selections agree.
  const changedNames=new Set([changed]);
  for(let pass=0;pass<columns.length;pass++) {
    const active=relevant.filter(c=>next[c.name]!=null&&next[c.name]!=='');
    if(!active.some(c=>intersects(c,changedNames)))break;
    const state=formState(columns,next,now,email,context,undefined,active.map(c=>c.name));let cleared=false;
    for(const c of active)if(state.editable[c.name]&&!state.errors[c.name]&&intersects(c,changedNames)&&Object.hasOwn(state.choices,c.name)&&!state.choices[c.name].includes(String(next[c.name]))) {
      next[c.name]=null;changedNames.add(c.name);cleared=true;
    }
    if(!cleared)break;
  }
  return next;
}
