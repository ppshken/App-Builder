import {systemFormulaColumns} from "./formula-system-schema";
import {parseExpression,type Value} from './expression';
import {normalizeValue,type Column,type FormulaField} from './columns';
type Node=ReturnType<typeof parseExpression>;
type Tables={name:string;columns?:Column[]}[];
const names:Record<string,string>={text:'ข้อความ (Text)',number:'ตัวเลข (Number / Decimal)',boolean:'จริง/เท็จ (Yes/No)',date:'วันที่ (Date)',datetime:'วันและเวลา (DateTime)',time:'เวลา (Time)',duration:'ระยะเวลา (Duration)',image:'รูปภาพ (Image)',file:'ไฟล์ (File)',latlong:'พิกัด (LatLong)',unknown:'ยังระบุไม่ได้',null:'ค่าว่าง'};
function columnKind(type:string){return ['number','decimal','price','percent','rating','ref','user'].includes(type)?'number':type==='yesno'?'boolean':['list','enumlist'].includes(type)?'list:unknown':['date','datetime','time','duration','image','file','latlong'].includes(type)?type:type==='signature'?'image':'text';}
function fieldKind(column?:Column){return !column?'unknown':column.type==='list'&&column.ref_table?'list:number':column.type==='enumlist'?'list:text':columnKind(column.type);}
function label(type:string):string{return type.startsWith('list:')?'รายการ (List / EnumList)'+(type==='list:unknown'?'':' ของ'+label(type.slice(5))):names[type]||type;}
export function formulaResultTypes(source:string,columns:Column[],tables:Tables=[]):string[]{
 const schema=(table:string)=>systemFormulaColumns(table)||tables.find(t=>t.name===table)?.columns||[];
 const kinds=(node:Node):string[]=>{
  switch(node.kind){
   case 'literal':return [node.value===null?'null':Array.isArray(node.value)?'list:unknown':typeof node.value==='boolean'?'boolean':typeof node.value==='number'?'number':'text'];
   case 'column':case 'outer':return [node.name==='id'?'number':fieldKind(columns.find(c=>c.name===node.name))];
   case 'deref':{const ref=columns.find(c=>c.name===node.column),target=ref?.ref_table?schema(ref.ref_table).find(c=>c.name===node.name):undefined;return [node.name==='id'?'number':fieldKind(target)];}
   case 'table':case 'related':{const target=schema(node.table).find(c=>c.name===node.name);return ['list:'+(node.name==='id'&&!systemFormulaColumns(node.table)?'number':fieldKind(target))];}
   case 'unary':return kinds(node.value).includes('duration')?['duration']:['number'];
   case 'binary':{
    if(['=','==','<>','!=','<','>','<=','>='].includes(node.op))return ['boolean'];if(node.op==='&')return ['text'];
    const left=kinds(node.left),right=kinds(node.right);
    if(left.includes('duration')&&right.includes('duration'))return ['duration'];
    if(node.op==='-'&&left.includes('datetime')&&right.includes('datetime'))return ['duration'];return ['number'];
   }
   case 'call':{
    const n=node.name;
    if(n==='IF')return [...kinds(node.args[1]),...kinds(node.args[2])];
    if(n==='IFS')return node.args.flatMap((arg,i)=>i%2===1?kinds(arg):[]);
    if(['AND','OR','NOT','IN','ISBLANK','ISNOTBLANK','ISOWNER'].includes(n))return ['boolean'];
    if(n==='TODAY'||n==='DATE')return ['date'];if(n==='NOW')return ['datetime'];if(n==='DURATION')return ['duration'];
    if(n==='SELECT'||n==='ORDERBY')return kinds(node.args[0]);
    if(n==='LIST'){const items=[...new Set(node.args.flatMap(kinds))];return ['list:'+(items.length===1?items[0]:'unknown')];}
    if(n==='INDEX')return kinds(node.args[0]).map(k=>k.startsWith('list:')?k.slice(5):'unknown');
    if(n==='SUM'&&kinds(node.args[0]).includes('list:duration'))return ['duration'];
    if(['COUNT','SUM','LEN','YEAR','MONTH','DAY','ROUND','ABS','DISTANCE','TOTALHOURS','TOTALMINUTES','TOTALSECONDS','USERID'].includes(n))return ['number'];
    if(n==='MIN'||n==='MAX')return ['number'];
    if(n==='USERSETTINGS')return ['unknown'];return ['text'];
   }
  }
 };
 return [...new Set(kinds(parseExpression(source)))];
}
function expected(column:Column,field:FormulaField){
 if(['show_if','required_if','editable_if'].includes(field))return ['boolean'];
 if(field==='valid_if')return ['enum','enumlist','list','ref'].includes(column.type)?['boolean','list:unknown']:['boolean'];
 return [columnKind(column.type)];
}
function matches(actual:string,wanted:string){
 if(actual==='unknown'||actual==='null')return true;
 if(wanted.startsWith('list:'))return actual.startsWith('list:');
 // String-backed data types also accept text expressions; format is checked with a sample.
 if(['date','datetime','time','duration','image','file','latlong'].includes(wanted)&&actual==='text')return true;
 if(wanted==='text'&&['image','file','latlong'].includes(actual))return true;
 return actual===wanted;
}
export function formulaTypeCheck(source:string,column:Column,field:FormulaField,columns:Column[],tables:Tables=[]){
 const expectedTypes=expected(column,field),actual=source.trim()?formulaResultTypes(source,columns,tables):[];
 const incompatible=actual.filter(kind=>!expectedTypes.some(wanted=>matches(kind,wanted)));
 const expectedLabel=expectedTypes.map(label).join(' หรือ '),actualLabel=actual.map(label).join(' หรือ ');
 const error=incompatible.length?'ผลลัพธ์สูตรเป็น '+actualLabel+' แต่ช่องนี้ต้องการ '+expectedLabel+' · หากต้องการเก็บผลลัพธ์นี้ ให้ใช้ชนิดข้อมูล '+[...new Set(incompatible.map(label))].join(' หรือ ')+' หรือปรับสูตรให้คืนชนิดที่ช่องต้องการ':'';
 return {expected:expectedLabel,actual:actualLabel,error};
}
export class FormulaResultTypeError extends Error {constructor(message:string,readonly columnTypes:string[]=[]){super(message);}}
export function validateFormulaResult(value:Value,column:Column,field:FormulaField,inferred:string[]=[]){
 const actual=inferred.includes('number')&&typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))?'number':inferred.includes('boolean')&&(value===0||value===1)?'boolean':value===null||value===''?'null':Array.isArray(value)?'list:unknown':typeof value==='number'?'number':typeof value==='boolean'?'boolean':'text',wanted=expected(column,field);
 if(!wanted.some(type=>matches(actual,type)))throw new FormulaResultTypeError('ผลลัพธ์สูตรเป็น '+label(actual)+' แต่ช่องนี้ต้องการ '+wanted.map(label).join(' หรือ ')+' · ผลลัพธ์นี้เหมาะกับชนิดข้อมูล '+label(actual),columnTypesForKind(actual));
 if(['default_expr','virtual_expr'].includes(field))normalizeValue(column,value);
}

function columnTypesForKind(kind:string){return kind.startsWith('list:')?['list']:kind==='number'?['number','decimal']:kind==='boolean'?['yesno']:kind==='text'?['text','longtext']:['unknown','null'].includes(kind)?[]:[kind];}
export function suggestedFormulaColumnTypes(source:string,columns:Column[],tables:Tables=[]){
 const types=formulaResultTypes(source,columns,tables).filter(t=>!['unknown','null'].includes(t));
 if(types.length!==1)return [];
 return columnTypesForKind(types[0]);
}
export function formulaColumnTypePatch(column:Column,type:string,field:FormulaField,source:string):Partial<Column>{
 return {type,[field]:source,ref_table:['list','ref','enum','enumlist'].includes(type)&&column.type===type?column.ref_table:null,scan_enabled:false,gps_auto:false,auto_number:null,max_length:['text','longtext'].includes(type)?column.max_length||0:0,is_label:column.is_label&&(column.type==='image')===(type==='image')?column.is_label:false,ref_allow_add:false,ref_delete_cascade:false,related_required:false,is_part_of:false};
}
