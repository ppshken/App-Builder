import {parseExpression} from './expression';
import type {Column} from './columns';

type Node=ReturnType<typeof parseExpression>;
type Plan={where:string;args:(string|number|null)[]};
// Deliberately conservative: unsupported formulas retain the existing interpreter.
// Never compile a fragment of AND/OR: doing so could change short-circuit errors.
export function sliceSql(source:string,columns:Column[],email:string):Plan|null {
 const numeric=new Set(['number','decimal','ref','user','price','percent','rating','yesno']);
 function field(n:Node):{sql:string;numeric:boolean;boolean:boolean}|null {
  if(n.kind!=='column'||!/^[a-z][a-z0-9_]{0,40}$/.test(n.name))return null;
  const c=n.name==='id'?{type:'number',is_virtual:false}:columns.find(c=>c.name===n.name);
  if(!c||c.is_virtual||!['text','longtext','enum',...numeric].includes(c.type))return null;
  let sql='"'+n.name+'"';
  if(['number','decimal','price'].includes(c.type)&&n.name!=='id')sql='(CASE WHEN typeof('+sql+") IN ('integer','real') AND abs("+sql+')<=1.7976931348623157e308 THEN '+sql+' END)';
  if(c.type==='yesno')sql='(CASE WHEN '+sql+' IN (0,1) THEN '+sql+' END)';
  if(['ref','user'].includes(c.type))sql='(CASE WHEN '+sql+'>=1 AND '+sql+'<=9007199254740991 AND '+sql+'=CAST('+sql+' AS INTEGER) THEN '+sql+' END)';
  if(c.type==='percent')sql='(CASE WHEN '+sql+' BETWEEN 0 AND 1 THEN '+sql+' END)';
  if(c.type==='rating')sql='(CASE WHEN '+sql+' BETWEEN 0 AND 5 AND '+sql+'=CAST('+sql+' AS INTEGER) THEN '+sql+' END)';
  // Enum normalization turns values outside static options into null in tolerant reads.
  // Escape metadata literals as SQL strings; expression/user values remain bound args.
  const column=columns.find(c=>c.name===n.name);
  if(column?.type==='enum'&&column.options?.trim()&&!column.valid_if?.trim()&&!column.ref_table){const options=column.options.split(',').map(v=>"'"+v.trim().replace(/'/g,"''")+"'");sql='(CASE WHEN '+sql+' IN ('+options.join(',')+') THEN '+sql+' END)';}
  return {sql,numeric:numeric.has(c.type),boolean:c.type==='yesno'};
 }
 function literal(n:Node):{value:string|number|boolean|null}|null {
  if(n.kind==='literal'&&!Array.isArray(n.value))return {value:n.value};
  if(n.kind==='call'&&n.name==='USEREMAIL')return {value:email};
  if(n.kind==='unary'&&n.value.kind==='literal'&&typeof n.value.value==='number')return {value:(n.op==='-'?-1:1)*n.value.value};
  return null;
 }
 function compile(n:Node):Plan|null {
  if(n.kind==='literal'&&(typeof n.value==='boolean'||n.value===0||n.value===1))return {where:n.value?'1':'0',args:[]};
  const f=field(n);if(f?.boolean)return {where:'COALESCE('+f.sql+',0)=1',args:[]};
  if(n.kind==='call'){
   if(['AND','OR'].includes(n.name)){const parts=n.args.map(compile);if(parts.some(p=>!p))return null;return {where:'('+parts.map(p=>p!.where).join(' '+n.name+' ')+')',args:parts.flatMap(p=>p!.args)};}
   if(n.name==='NOT'){const p=compile(n.args[0]);return p?{where:'NOT ('+p.where+')',args:p.args}:null;}
   if(['ISBLANK','ISNOTBLANK'].includes(n.name)){const f=field(n.args[0]);return f?{where:'('+f.sql+' IS '+(n.name==='ISNOTBLANK'?'NOT ':'')+'NULL'+(n.name==='ISNOTBLANK'?' AND ':' OR ')+f.sql+(n.name==='ISNOTBLANK'?"<>''":"=''")+')',args:[]}:null;}
  }
  if(n.kind==='binary'&&['=','==','<>','!=','<','>','<=','>='].includes(n.op)){
   const left=field(n.left),right=field(n.right),f=left||right,v=literal(left?n.right:n.left);if(!f||!v)return null;
   const equality=['=','==','<>','!='].includes(n.op),negated=['<>','!='].includes(n.op),blank=v.value===null||v.value==='';
   if(equality){
    if(blank)return {where:'('+f.sql+(negated?' IS NOT NULL AND ':' IS NULL OR ')+f.sql+(negated?"<>''":"=''")+')',args:[]};
    if(f.numeric?typeof v.value==='string':typeof v.value!=='string')return {where:negated?'1':'0',args:[]};
    return {where:'('+f.sql+(negated?' IS NOT ?':' IS ?')+')',args:[typeof v.value==='boolean'?Number(v.value):v.value]};
   }
   if(!f.numeric||typeof v.value!=='number'||!Number.isFinite(v.value))return null;
   return {where:'COALESCE('+(left?f.sql+n.op+'?':'?'+n.op+f.sql)+',0)',args:[v.value]};
  }
  return null;
 }
 try{return compile(parseExpression(source));}catch{return null;}
}
