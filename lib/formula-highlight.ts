export type FormulaToken={text:string;kind:'plain'|'function'|'table'|'column'|'string'|'number'|'keyword'|'operator';matched?:boolean};
// Tolerant scanner for display only. Incomplete formulas remain editable;
// validation and execution continue to use the existing expression parser.
export function highlightFormula(source:string,caret?:number):FormulaToken[] {
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
 if(caret===undefined)return tokens;
 const pair=formulaBracketPair(source,caret,tokens);if(!pair)return tokens;
 const marked=new Set(pair),result:FormulaToken[]=[];let offset=0;
 for(const token of tokens){let start=0;for(let j=0;j<token.text.length;j++)if(marked.has(offset+j)){if(j>start)result.push({...token,text:token.text.slice(start,j)});result.push({...token,text:token.text[j],matched:true});start=j+1;}if(start<token.text.length)result.push({...token,text:token.text.slice(start)});offset+=token.text.length;}
 return result;
}

// Positions are textarea UTF-16 offsets. Ignore brackets inside strings/column names.
export function formulaBracketPair(source:string,caret:number,tokens=highlightFormula(source)):[number,number]|null {
 if(!Number.isInteger(caret)||caret<0||caret>source.length)return null;
 const pairs=new Map<number,number>(),stack:number[]=[];let offset=0;
 const link=(open:number,close:number)=>{pairs.set(open,close);pairs.set(close,open);};
 for(const token of tokens){
  if(token.kind==='column'){if(token.text.endsWith(']'))link(offset,offset+token.text.length-1);}
  else if(token.kind!=='string')for(let j=0;j<token.text.length;j++){if(token.text[j]==='(')stack.push(offset+j);else if(token.text[j]===')'&&stack.length)link(stack.pop()!,offset+j);}
  offset+=token.text.length;
 }
 for(const at of [caret,caret-1])if(pairs.has(at)){const other=pairs.get(at)!;return at<other?[at,other]:[other,at];}
 return null;
}
