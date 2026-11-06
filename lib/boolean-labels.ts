type BooleanColumn = {options?:string|null};
export function booleanLabels(column:BooleanColumn,fallback=true):{true:string;false:string}{
  let labels:any;try{labels=JSON.parse(column.options||'null');}catch{}
  return {true:typeof labels?.true==='string'&&labels.true.trim()?labels.true:(fallback?'ใช่':''),false:typeof labels?.false==='string'&&labels.false.trim()?labels.false:(fallback?'ไม่ใช่':'')};
}
export function normalizeBooleanLabels(options:unknown):string|null{
  if(options==null||options==='')return null;
  let labels:any;try{labels=JSON.parse(String(options));}catch{throw Error('ชื่อแสดงผล True/False ไม่ถูกต้อง');}
  if(!labels||Array.isArray(labels)||typeof labels!=='object'||Object.keys(labels).some(k=>!['true','false'].includes(k))||Object.values(labels).some(v=>typeof v!=='string'||v.length>100))throw Error('ชื่อแสดงผล True/False ต้องเป็นข้อความไม่เกิน 100 ตัวอักษร');
  return JSON.stringify({true:(labels.true||'').trim(),false:(labels.false||'').trim()});
}
export function booleanLabel(column:BooleanColumn,value:unknown):string{
  if(value==null||value==='')return '';
  return booleanLabels(column)[value===true||value===1||value==='1'||value==='true'?'true':'false'];
}
