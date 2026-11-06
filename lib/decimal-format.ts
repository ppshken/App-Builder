type DecimalColumn={options?:string|null};
export function decimalPlaces(column:DecimalColumn):number|null{
 try{const n=JSON.parse(column.options||'null')?.decimal_places;return Number.isInteger(n)&&n>=0&&n<=10?n:null;}catch{return null;}
}
export function normalizeDecimalOptions(options:unknown):string|null{
 if(options==null||options==='')return null;
 let config:any;try{if(typeof options!=='string')throw Error();config=JSON.parse(options);}catch{throw Error('การตั้งค่าทศนิยมไม่ถูกต้อง');}
 if(!config||Array.isArray(config)||typeof config!=='object'||Object.keys(config).some(k=>k!=='decimal_places')||!Number.isInteger(config.decimal_places)||config.decimal_places<0||config.decimal_places>10)throw Error('จำนวนตำแหน่งทศนิยมต้องเป็นจำนวนเต็ม 0–10');
 return JSON.stringify({decimal_places:config.decimal_places});
}
export function decimalLabel(column:DecimalColumn,value:unknown):string{
 if(value==null||value==='')return '';
 const places=decimalPlaces(column),n=Number(value);
 if(places===null||!Number.isFinite(n))return String(value);
 return new Intl.NumberFormat('en-US',{useGrouping:false,minimumFractionDigits:places,maximumFractionDigits:places}).format(n);
}
