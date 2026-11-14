import type {ExpressionTable,Value} from './expression';

// Request-local indexes over already permission-filtered, immutable snapshots.
// Never share these across requests, users, applications or writes.
export function expressionLookup(){
 const indexes=new WeakMap<ExpressionTable,Map<string,Map<unknown,Record<string,Value>[]>|null>>();
 const key=(value:unknown):unknown=>value==null||value===''?null:typeof value==='boolean'?Number(value):value;
 return (data:ExpressionTable,column:string,value:Value):Record<string,Value>[]|undefined=>{
  if(Array.isArray(value))return;
  let columns=indexes.get(data);if(!columns)indexes.set(data,columns=new Map());
  if(!columns.has(column)){
   const groups=new Map<unknown,Record<string,Value>[]>();let usable=true;
   for(const row of data.rows){
    // Missing fields must still report interpreter errors; arrays use the full
    // equality implementation, including blank-list semantics.
    if(!Object.hasOwn(row,column)){usable=false;break;}
    const value=row[column];if(Array.isArray(value)){usable=false;break;}
    const id=key(value),group=groups.get(id);if(group)group.push(row);else groups.set(id,[row]);
   }
   columns.set(column,usable?groups:null);
  }
  const groups=columns.get(column);return groups?groups.get(key(value))||[]:undefined;
 };
}
