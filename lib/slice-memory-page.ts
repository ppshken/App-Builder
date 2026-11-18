import {calculateRow,refTablesOf,type Column} from './columns';
import {asBoolean,evaluateExpression,references,type ExpressionContext} from './expression';
import {visibleRawRows} from './row-access';
import {matchesFilters,type DataFilter} from './data-filters';
import type {PreparedReadRow} from './view-records';

// Unsupported SQL predicates still use the same interpreter and full-row access
// checks. Only defer fields that do not decide membership, ordering or filters.
export function sliceMemoryPage(table:string,columns:Column[],source:string,raw:Record<string,any>[],now:Date,email:string,context:ExpressionContext,options:{page:number;size:number;sort:string;direction:1|-1;filters:DataFilter[]}){
 const needed=new Set([...references(source),options.sort,...options.filters.map(f=>f.column)]);
 for(const name of needed){const c=columns.find(c=>c.name===name);if(c?.is_virtual&&c.virtual_expr)for(const dependency of references(c.virtual_expr))needed.add(dependency);}
 const selected=columns.filter(c=>needed.has(c.name)),expression={...context,tableName:table,refTables:refTablesOf(columns),userEmail:email},prepared=new Map<number,PreparedReadRow>();
 const matches: {raw:Record<string,any>;row:Record<string,any>}[]=[];
 for(const row of visibleRawRows(table,raw)){
  const calculated=calculateRow(selected,row,false,now,true,email,expression);
  if(asBoolean(evaluateExpression(source,calculated.row,expression))&&matchesFilters(calculated.row,options.filters,columns)){prepared.set(Number(row.id),calculated);matches.push({raw:row,row:calculated.row});}
 }
 matches.sort((a,b)=>{const left=a.row[options.sort],right=b.row[options.sort],comparison=left==null?right==null?0:-1:right==null?1:typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'th');return options.direction*(comparison||a.raw.id-b.raw.id);});
 const total=matches.length,page=Math.min(options.page,Math.max(1,Math.ceil(total/options.size))),items=matches.slice((page-1)*options.size,page*options.size);
 // Retain only the page's prepared values, including errors and volatile results.
 const pagePrepared=new Map(items.map(item=>[Number(item.raw.id),prepared.get(Number(item.raw.id))!]));
 return {rawRows:items.map(item=>item.raw),prepared:pagePrepared,total,page};
}
