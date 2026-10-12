type Edit={value:string;start:number;end:number};
const INDENT="  ";
export function editFormula(source:string,start:number,end:number,key:string,shift=false):Edit|null{
 const lineStart=source.lastIndexOf("\n",start-1)+1;
 if(key==="Enter"){
  const before=source.slice(lineStart,start),indent=/^[\t ]*/.exec(before)![0];
  const opens=/[({]\s*$/.test(before),closes=/^\s*[)}]/.test(source.slice(end));
  const prefix="\n"+indent+(opens?INDENT:"");
  const insert=prefix+(opens&&closes?"\n"+indent:"");
  return {value:source.slice(0,start)+insert+source.slice(end),start:start+prefix.length,end:start+prefix.length};
 }
 if(key!=="Tab")return null;
 if(start===end&&!shift)return {value:source.slice(0,start)+INDENT+source.slice(end),start:start+2,end:start+2};
 // A selection ending at the start of a line excludes that line.
 const blockEnd=end>start&&source[end-1]==="\n"?end-1:end;
 const lastEnd=source.indexOf("\n",blockEnd),stop=lastEnd<0?source.length:lastEnd;
 const lines=source.slice(lineStart,stop).split("\n");
 let delta=0,firstDelta=0;
 const replacement=lines.map((line,i)=>{
  const removed=shift?(line.startsWith("\t")?1:Math.min(2,/^ */.exec(line)![0].length)):0;
  const change=shift?-removed:2;if(i===0)firstDelta=change;delta+=change;
  return shift?line.slice(removed):INDENT+line;
 }).join("\n");
 const nextStart=shift?Math.max(lineStart,start+firstDelta):start+firstDelta;
 return {value:source.slice(0,lineStart)+replacement+source.slice(stop),start:nextStart,end:Math.max(nextStart,end+delta)};
}
