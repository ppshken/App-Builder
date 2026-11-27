import { decimalPlaces } from "./decimal-format";
const formatters=new Map<string,Intl.NumberFormat>();
function numericFormatter(type:string,places:number|null){
 const key=type+':'+places;let formatter=formatters.get(key);
 if(!formatter){const precision=places===null?{}:{minimumFractionDigits:places,maximumFractionDigits:places};formatter=new Intl.NumberFormat('th-TH',type==='price'?{style:'currency',currency:'THB',...precision}:{style:'percent',maximumFractionDigits:6,...precision});if(formatters.size>=32)formatters.delete(formatters.keys().next().value!);formatters.set(key,formatter);}
 return formatter;
}
export const NUMERIC_VALUE_TYPES=['price','percent','rating'];
export function valueLabel(type:string,value:unknown,options?:string|null):string{if(value==null||value==='')return '—';const n=Number(value);if(!Number.isFinite(n))return String(value);if(type==='price'||type==='percent')return numericFormatter(type,decimalPlaces({options})).format(n);if(type==='rating')return '★'.repeat(Math.max(0,Math.min(5,Math.trunc(n))))+'☆'.repeat(5-Math.max(0,Math.min(5,Math.trunc(n))));return String(value);}
