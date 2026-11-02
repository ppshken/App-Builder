import {FUNCTION_NAMES} from "./expression";
import type {Column} from "./columns";
import {relatedFormulaSources} from "./formula-related";
export type FormulaTable={name:string;label?:string;columns?:Column[]};
export type Completion={label:string;insert:string;kind:string;description?:string;cursorBack?:number};
export function formulaCompletions(source:string,caret:number,columns:Column[],tables:FormulaTable[]):{start:number;items:Completion[]}{
 const before=source.slice(0,caret);
 // Ignore identifiers within quoted strings.
 let quote="";for(let i=0;i<before.length;i++){const ch=before[i];if(ch==="\\"){i++;continue;}if(quote){if(ch===quote){if(before[i+1]===quote)i++;else quote="";}}else if(ch==='"'||ch==="'")quote=ch;}
 if(quote)return {start:caret,items:[] as Completion[]};
 const bracket=/\[([^\]\n]*)$/.exec(before);
 if(bracket){
  const prefix=before.slice(0,bracket.index),owner=/([a-z][a-z0-9_]*)\s*$/i.exec(prefix)?.[1];
  const select=/SELECT\s*\(\s*([a-z][a-z0-9_]*)\s*\[[^\]]*\]\s*,[^)]*$/i.exec(prefix)?.[1];
  let cols=owner?tables.find(t=>t.name===owner)?.columns:select?tables.find(t=>t.name===select)?.columns:columns;
  const deref=/\[([^\]]+)\]\.\s*$/.exec(prefix);
  if(deref){const ref=columns.find(c=>c.name===deref[1]);cols=deref[1]==="_THISROW"?columns:tables.find(t=>t.name===ref?.ref_table)?.columns;}
  const related=/\[Related_([a-z][a-z0-9_]{0,40})(?::[a-z][a-z0-9_]{0,40})?\]\s*$/.exec(prefix);
  if(related)cols=tables.find(t=>t.name===related[1])?.columns?.filter(c=>!["list","enumlist"].includes(c.type));
  const candidates=[{name:"id",type:"Number"},...(cols||[])];
  if(!owner&&!select&&!deref&&!related){
    candidates.push({name:"_THISROW",type:"Row"},{name:"_THIS",type:"Value"});
    for(const related of relatedFormulaSources(columns,tables))candidates.push({name:related.alias,type:"Related List"});
  }
  return {start:bracket.index+1,items:candidates.filter(c=>c.name.toLowerCase().startsWith(bracket[1].toLowerCase())).map(c=>({label:c.name,insert:c.name+(source[caret]==="]"?"":"]"),kind:c.type}))};
 }
 const word=/[a-z_][a-z0-9_]*$/i.exec(before);if(!word)return {start:caret,items:[] as Completion[]};
 const descriptions:Record<string,string>={SELECT:"เลือกรายการจากตารางตามเงื่อนไข",IF:"เลือกค่าตามเงื่อนไข",USEREMAIL:"อีเมลผู้ใช้ปัจจุบัน",COUNT:"นับจำนวนรายการ",SUM:"รวมค่าตัวเลข"};
 const items:Completion[]=[...FUNCTION_NAMES.map(name=>({label:name+"()",insert:name+(source[caret]==="("?"":"()"),kind:"Function",description:descriptions[name],cursorBack:source[caret]==="("?0:1})),...tables.map(t=>({label:t.name,insert:t.name,kind:"Table",description:t.label})),...['TRUE','FALSE','NULL'].map(name=>({label:name,insert:name,kind:"Value"}))];
 return {start:caret-word[0].length,items:items.filter(item=>item.label.toLowerCase().startsWith(word[0].toLowerCase()))};
}
