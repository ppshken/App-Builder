export type FormulaToken={text:string;kind:'plain'|'function'|'table'|'column'|'string'|'number'|'keyword'|'operator'};
// Tolerant scanner for display only. Incomplete formulas remain editable;
// validation and execution continue to use the existing expression parser.
export function highlightFormula(source:string):FormulaToken[] {
 const tokens:FormulaToken[]=[];let i=0;
 const push=(end:number,kind:FormulaToken['kind'])=>{tokens.push({text:source.slice(i,end),kind});i=end;};
 while(i<source.length){
  const ch=source[i];
  if(ch==='"'||ch==="'"){let j=i+1;while(j<source.length){if(source[j]==='\\'){j+=Math.min(2,source.length-j);continue;}if(source[j]===ch){if(source[j+1]===ch){j+=2;continue;}j++;break;}j++;}push(j,'string');continue;}
  if(ch==='['){const close=source.indexOf(']',i+1);push(close<0?source.length:close+1,'column');continue;}
  const tail=source.slice(i),name=/^[a-zA-Z_][a-zA-Z0-9_]*/.exec(tail);
  if(name){const end=i+name[0].length,next=source.slice(end).trimStart()[0];push(end,/^(TRUE|FALSE|NULL)$/i.test(name[0])?'keyword':next==='('?'function':next==='['?'table':'plain');continue;}
  const number=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(tail);
  if(number){push(i+number[0].length,'number');continue;}
  if(/[+*/%<>=!&-]/.test(ch)){push(i+1,'operator');continue;}
  let end=i+1;while(end<source.length&&/\s/.test(source[end])&&/\s/.test(ch))end++;
  push(end,'plain');
 }
 return tokens;
}
