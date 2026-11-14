import type Database from 'better-sqlite3';
import {IDENT,labelTextColumn,labelImageColumn,type Column} from './columns';
import type {parseExpression,Value} from './expression';
import {sliceSqlNode} from './slice-sql';
import {assertTablePermission} from './permissions';
import {hasRowRule} from './row-access';
type Node=ReturnType<typeof parseExpression>;
export type AggregateReader=(op:'COUNT'|'SUM',input:Node,outer:(name:string)=>Value)=>number|undefined;
export function formulaAggregate(database:Database.Database,columnsOf:(table:string)=>Column[],exists:(table:string)=>boolean,email:string):AggregateReader{
 const valid=new Map<string,boolean>(),indexes=new Map<string,boolean>(),results=new Map<string,number>();
 return (op,input,outer)=>{
  const select=input.kind==='call'&&input.name==='SELECT'?input:null,source=select?select.args[0]:input;
  if(source.kind!=='table'||!IDENT.test(source.table)||!exists(source.table))return;
  const table=source.table;assertTablePermission(table,'read');if(hasRowRule(table,database))return;
  if(select?.args[2]&&(select.args[2].kind!=='literal'||![false,0,null,''].includes(select.args[2].value as any)))return;
  const predicate=select?.args[1]||{kind:'literal',value:true,start:0,end:0} as Node;
  // Entire predicates only. Never pre-evaluate lazy AND/OR, dereferences,
  // virtual columns, volatile calls or SELECT inside another predicate.
  const operand=(n:Node)=>['column','outer','literal'].includes(n.kind)||n.kind==='unary'&&n.value.kind==='literal'&&typeof n.value.value==='number';
  if(predicate.kind!=='literal'&&!(predicate.kind==='binary'&&['=','==','<>','!=','<','>','<=','>='].includes(predicate.op)&&operand(predicate.left)&&operand(predicate.right)))return;
  if(predicate.kind==='binary'){
   const field=predicate.left.kind==='column'?predicate.left:predicate.right.kind==='column'?predicate.right:null;
   if(!field||predicate.left.kind==='column'&&predicate.right.kind==='column')return;
   const cacheKey=table+':'+field.name;
   try{if(!indexes.has(cacheKey)){
    const indexed=field.name==='id'||(database.prepare('SELECT * FROM pragma_index_list(?)').all('t_'+table) as {name:string;partial:number}[]).some(index=>!index.partial&&(database.prepare('SELECT * FROM pragma_index_xinfo(?)').all(index.name) as {name:string;seqno:number;coll:string}[]).some(c=>c.seqno===0&&c.name===field.name&&c.coll==='BINARY'));
    indexes.set(cacheKey,indexed);
   }}catch{return;}
   // An existing in-memory lookup beats repeated SQL full scans on unindexed predicates.
   if(!indexes.get(cacheKey))return;
  }
  const cols=columnsOf(table),find=(name:string)=>name==='id'?{name:'id',type:'number'} as Column:cols.find(c=>c.name===name),requested=[source.name];
  if(predicate.kind==='binary')for(const side of [predicate.left,predicate.right])if(side.kind==='column')requested.push(side.name);
  const key=cols.find(c=>c.is_key)?.name||'id',label=labelTextColumn(cols),image=labelImageColumn(cols);
  const needed=new Set([...requested,key,...cols.filter(c=>c.type==='ref'&&!c.is_virtual).map(c=>c.name),...cols.filter(c=>!c.is_virtual&&(c.name===label||c.name===image)).map(c=>c.name)]);
  const selected=[...needed].map(find);if(selected.some(c=>!c||c.is_virtual||!IDENT.test(c.name)||!['text','longtext','number','decimal','ref','yesno'].includes(c.type)||['text','longtext'].includes(c.type)&&!!c.max_length))return;
  if(predicate.kind==='binary'&&[predicate.left,predicate.right].some(n=>n.kind==='column'&&['text','longtext'].includes(find(n.name)?.type||'')))return;
  const target=find(source.name)!;if(op==='SUM'&&!['number','decimal','ref','yesno'].includes(target.type))return;
  const quote=(name:string)=>'"'+name+'"',from=' FROM "t_'+table+'"';
  try{
   const validityKey=table+':'+[...needed].sort().join(',');
   if(!valid.has(validityKey)){
    const tests=(selected as Column[]).map(c=>{const n=quote(c.name);let type=['text','longtext'].includes(c.type)?"typeof("+n+")='text'":"typeof("+n+") IN ('integer','real') AND abs("+n+')<=1.7976931348623157e308 AND (typeof('+n+")='real' OR abs("+n+')<=9007199254740991)' ;if(c.type==='ref')type+=' AND '+n+' BETWEEN 1 AND 9007199254740991 AND '+n+'=CAST('+n+' AS INTEGER)';if(c.type==='yesno')type+=' AND '+n+' IN (0,1)';return '('+n+' IS NULL OR '+n+"='' OR ("+type+'))';});
    valid.set(validityKey,!database.prepare('SELECT 1'+from+' WHERE NOT ('+tests.join(' AND ')+') LIMIT 1').get());
   }
   if(!valid.get(validityKey))return;
   // On empty datasets the interpreter never resolves outer fields.
   if(!database.prepare('SELECT 1'+from+' LIMIT 1').get())return 0;
   const literal=(value:Value):Node=>{if(Array.isArray(value)||typeof value==='number'&&!Number.isFinite(value))throw Error('Unsupported aggregate value');return {kind:'literal',value,start:0,end:0};};
   const replace=(n:Node):Node=>n.kind==='outer'?literal(outer(n.name)):n.kind==='literal'?literal(n.value):n.kind==='binary'?{...n,left:replace(n.left),right:replace(n.right)}:n;
   const plan=sliceSqlNode(replace(predicate),cols,email,true);if(!plan)return;
   if(predicate.kind==='binary'&&!['=','==','<>','!='].includes(predicate.op)){const field=predicate.left.kind==='column'?predicate.left:predicate.right.kind==='column'?predicate.right:null;if(field)plan.where='('+plan.where+') AND '+quote(field.name)+"<>''";}
   const resultKey=JSON.stringify([op,table,source.name,plan]);if(resultKey.length<=8000&&results.has(resultKey))return results.get(resultKey);
   const value=quote(source.name),where=' WHERE '+plan.where;
   if(op==='SUM'){
    // Floating summation order/rounding differs between engines. Restrict the
    // native path to integers whose absolute total stays exactly representable.
    const stats=database.prepare('SELECT max(CASE WHEN '+value+' IS NOT NULL AND '+value+"<>'' AND "+value+'<>CAST('+value+' AS INTEGER) THEN 1 ELSE 0 END) fractional,total(abs('+value+')) magnitude'+from+where).get(...plan.args) as {fractional:number;magnitude:number};
    if(stats.fractional||!Number.isFinite(stats.magnitude)||stats.magnitude>Number.MAX_SAFE_INTEGER)return;
   }
   const result=database.prepare('SELECT '+(op==='COUNT'?'count(nullif('+value+",''))":'coalesce(sum('+value+'),0)')+' value'+from+where).get(...plan.args) as {value:number};
   if(typeof result.value!=='number'||!Number.isFinite(result.value))return;
   if(resultKey.length<=8000){if(results.size>=512)results.delete(results.keys().next().value!);results.set(resultKey,result.value);}return result.value;
  }catch{return;}// Unsupported storage or outer resolution: preserve interpreter errors.
 };
}
