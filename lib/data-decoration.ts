import {asBoolean,evaluateExpression,references,tableReferences,referencePaths,renameReference,type ExpressionOptions} from "./expression";
import {ICON_CATALOG} from "./icons";
import type {Column} from "./columns";
export type ValueStyle={style?:"plain"|"badge"|"outline"|"soft";icon?:string;icon_color?:string;color?:string;background?:string;border_color?:string;size?:"small"|"medium"|"large";radius?:number;bold?:boolean;icon_position?:"before"|"after"};
export type DataStyle=ValueStyle&{rules?:{condition:string;appearance:ValueStyle}[]};
export const VALUE_STYLE_DEFAULTS:Required<ValueStyle>={style:"plain",icon:"",icon_color:"",color:"",background:"",border_color:"",size:"medium",radius:12,bold:false,icon_position:"before"};
const keys=Object.keys(VALUE_STYLE_DEFAULTS);
export function decorationColumns(cols:Column[]){return cols.filter(c=>!["image","list","latlong"].includes(c.type));}
function validateStyle(v:unknown){if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error("ตัวเลือกตกแต่งข้อมูลไม่ถูกต้อง");const s=v as ValueStyle;
for(const [key,choices] of Object.entries({style:["plain","badge","outline","soft"],size:["small","medium","large"],icon_position:["before","after"]}))if((s as any)[key]!==undefined&&!choices.includes((s as any)[key]))throw Error("รูปแบบ badge ขนาด หรือตำแหน่งไอคอนไม่ถูกต้อง");
for(const key of ["color","background","border_color","icon_color"] as const)if(s[key]!==undefined&&(typeof s[key]!=="string"||s[key]!==""&&!/^#[a-f0-9]{6}$/i.test(s[key]!)))throw Error("สีตกแต่งข้อมูลต้องเป็นรหัสสี เช่น #15803D");
if(s.icon!==undefined&&(typeof s.icon!=="string"||s.icon!==""&&!ICON_CATALOG.some(i=>i.name===s.icon)))throw Error("กรุณาเลือกไอคอนตกแต่งข้อมูลจากรายการ");
if(s.radius!==undefined&&(typeof s.radius!=="number"||!Number.isInteger(s.radius)||s.radius<0||s.radius>32))throw Error("มุม badge ต้องเป็นจำนวนเต็ม 0–32");if(s.bold!==undefined&&typeof s.bold!=="boolean")throw Error("ตัวหนาต้องเป็นค่าเปิดหรือปิด");}
export function validateDataStyles(value:unknown,cols:Column[]){if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length>200)throw Error("การตกแต่งข้อมูลต้องกำหนดแยกตามคอลัมน์");const names=new Set(["id",...cols.map(c=>c.name)]),allowed=new Set(decorationColumns(cols).map(c=>c.name));for(const [name,raw] of Object.entries(value)){if(!allowed.has(name))throw Error("เลือกคอลัมน์ข้อความ ตัวเลข วันที่ หรือตัวเลือกสำหรับตกแต่งข้อมูล");if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("การตกแต่งข้อมูลไม่ถูกต้อง");const {rules,...style}=raw as DataStyle;validateStyle(style);if(rules!==undefined){if(!Array.isArray(rules)||rules.length>20)throw Error("กำหนดกฎตกแต่งได้ไม่เกิน 20 กฎต่อคอลัมน์");for(const rule of rules){if(!rule||typeof rule!=="object"||Array.isArray(rule)||Object.keys(rule).some(k=>!["condition","appearance"].includes(k))||typeof rule.condition!=="string"||!rule.condition.trim()||rule.condition.length>2000)throw Error("กรุณากรอกเงื่อนไขของกฎตกแต่ง ไม่เกิน 2,000 ตัวอักษร");for(const n of references(rule.condition))if(n!=="_THIS"&&!names.has(n))throw Error("เงื่อนไขตกแต่งอ้างคอลัมน์ที่ไม่มีอยู่ ["+n+"]");if(tableReferences(rule.condition).length||referencePaths(rule.condition).length)throw Error("เงื่อนไขตกแต่งใช้ค่าคอลัมน์ของแถวนี้ เช่น [_THIS] = \"สำเร็จ\" ไม่ดึงข้อมูลข้ามตาราง");validateStyle(rule.appearance);}}}}
export function dataStyleFor(column:string,row:Record<string,any>,config?:DataStyle,options:ExpressionOptions={}){if(!config)return {appearance:VALUE_STYLE_DEFAULTS,error:""};const {rules,...base}=config;for(const rule of rules||[])try{if(asBoolean(evaluateExpression(rule.condition,{...row,_THIS:row[column]},options)))return {appearance:{...VALUE_STYLE_DEFAULTS,...base,...rule.appearance},error:""};}catch(e){return {appearance:{...VALUE_STYLE_DEFAULTS,...base},error:"เงื่อนไขตกแต่ง: "+(e as Error).message};}return {appearance:{...VALUE_STYLE_DEFAULTS,...base},error:""};}
export function decorationReferences(styles:Record<string,DataStyle>={}){return [...new Set([...Object.keys(styles),...Object.values(styles).flatMap(s=>(s.rules||[]).flatMap(r=>references(r.condition).filter(n=>n!=="_THIS")))])];}
export function changeDecorationColumn(styles:Record<string,DataStyle>,old:string,next?:string){return Object.fromEntries(Object.entries(styles).flatMap(([name,style])=>{if(name===old&&!next)return [];return [[name===old?next!:name,{...style,rules:style.rules?.flatMap(r=>!next&&references(r.condition).includes(old)?[]:[{...r,condition:next?renameReference(r.condition,old,next):r.condition}])}]];}));}

// Legacy per-view rules are consolidated in stable view order without counting copies twice.
export function tableDataStyles(views:{table_name:string;display?:{data_styles?:Record<string,DataStyle>}}[],table:string):Record<string,DataStyle>{
 const result:Record<string,DataStyle>=Object.create(null);
 for(const view of views.filter(v=>v.table_name===table))for(const [name,style]of Object.entries(view.display?.data_styles||{})){
  if(!result[name]){result[name]={...style,...(style.rules?{rules:[...style.rules]}:{})};continue;}
  if(!style.rules?.length)continue;
  const rules=result[name].rules??=[],counts=new Map<string,number>(),seen=new Map<string,number>();
  for(const r of rules){const k=JSON.stringify(r);counts.set(k,(counts.get(k)||0)+1);}
  for(const rule of style.rules){const k=JSON.stringify(rule),n=(seen.get(k)||0)+1;seen.set(k,n);if(n>(counts.get(k)||0))rules.push(rule);}
  result[name].rules=rules;
 }
 return result;
}
export function dataStyleRuleCount(styles:Record<string,DataStyle>={}){return Object.values(styles).reduce((n,s)=>n+(s.rules?.length||0),0);}
