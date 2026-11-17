export type RawFilter={column:string;op:string;value?:string;value2?:string};
export type RawQuery={search?:string;filters?:RawFilter[];join?:'and'|'or';sort?:string;direction?:'asc'|'desc';ids?:number[]};
export type RawColumn={name:string;type:string};
const quote=(name:string)=>'"'+name.replace(/"/g,'""')+'"';
const escapeLike=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
export function rawQuery(input:unknown,columns:RawColumn[]){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('ตัวกรองไม่ถูกต้อง');
 const q=input as RawQuery,names=new Set(columns.map(c=>c.name)),args:(string|number)[]=[],conditions:string[]=[];
 if(q.search!==undefined&&(typeof q.search!=='string'||q.search.length>200))throw Error('ค้นหาได้ไม่เกิน 200 ตัวอักษร');
 if(q.search?.trim()){conditions.push('('+columns.map(c=>'CAST('+quote(c.name)+' AS TEXT) LIKE ? ESCAPE \'\\\'').join(' OR ')+')');args.push(...columns.map(()=>'%'+escapeLike(q.search!.trim())+'%'));}
 if(q.join!==undefined&&!['and','or'].includes(q.join))throw Error('รูปแบบรวมเงื่อนไขไม่ถูกต้อง');
 if(q.filters!==undefined&&(!Array.isArray(q.filters)||q.filters.length>12))throw Error('เพิ่มเงื่อนไขได้ไม่เกิน 12 ข้อ');
 const filters=(q.filters||[]).map(f=>{
  if(!f||!names.has(f.column))throw Error('ไม่พบคอลัมน์ตัวกรอง');const field=quote(f.column);
  if(f.op==='null')return field+' IS NULL';if(f.op==='notnull')return field+' IS NOT NULL';if(f.op==='empty')return field+" = ''";if(f.op==='notempty')return '('+field+" IS NOT NULL AND "+field+" <> '')";
  if(typeof f.value!=='string'||f.value.length>2000)throw Error('ค่าตัวกรองไม่ถูกต้อง');
  if(['contains','starts','ends'].includes(f.op)){args.push((f.op==='starts'?'':'%')+escapeLike(f.value)+(f.op==='ends'?'':'%'));return 'CAST('+field+' AS TEXT) LIKE ? ESCAPE \'\\\'';}
  const numeric=/INT|REAL|FLOA|DOUB|NUM|DEC|BOOL/i.test(columns.find(c=>c.name===f.column)!.type);
  const value=(s:string)=>{if(!numeric)return s;const n=Number(s);if(!s.trim()||!Number.isFinite(n))throw Error('ตัวกรองคอลัมน์ตัวเลขต้องเป็นตัวเลข');return n;};
  if(f.op==='between'){if(typeof f.value2!=='string'||f.value2.length>2000)throw Error('กรุณาระบุช่วงข้อมูล');args.push(value(f.value),value(f.value2));return field+' BETWEEN ? AND ?';}
  const ops:Record<string,string>={eq:'=',ne:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='};if(!ops[f.op])throw Error('เงื่อนไขตัวกรองไม่ถูกต้อง');args.push(value(f.value));return field+' '+ops[f.op]+' ?';
 });
 if(filters.length)conditions.push('('+filters.join(q.join==='or'?' OR ':' AND ')+')');
 if(q.ids!==undefined){if(!Array.isArray(q.ids)||!q.ids.length||q.ids.length>100||q.ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('รายการแถวที่เลือกไม่ถูกต้อง');conditions.push('"id" IN ('+[...new Set(q.ids)].map(()=>'?').join(',')+')');args.push(...new Set(q.ids));}
 const sort=q.sort||'id';if(!names.has(sort)||q.direction!==undefined&&!['asc','desc'].includes(q.direction))throw Error('การเรียงลำดับไม่ถูกต้อง');
 return {where:conditions.length?conditions.join(' AND '):'1=1',args,order:quote(sort)+' '+(q.direction==='desc'?'DESC':'ASC')+(sort==='id'?'':', "id" ASC')};
}
export function parseRawQuery(value:string|null):RawQuery{if(!value)return {};if(value.length>16000)throw Error('ตัวกรองยาวเกินไป');try{return JSON.parse(value);}catch{throw Error('รูปแบบตัวกรองไม่ถูกต้อง');}}
// Execution is additionally isolated in a table-only read-only DB with a timeout.
export function validateRawSelect(sql:unknown){
 if(typeof sql!=='string'||sql.length>16000||!/^\s*(SELECT|WITH)\b/i.test(sql))throw Error('รองรับ SELECT หรือ WITH สำหรับอ่านข้อมูลเท่านั้น');
 const tokens=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[(?:[^\]])*\]|--[^\n]*|\/\*[\s\S]*?\*\//g,' ');
 const unquotedStrings=sql.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g,' ');
 if(/["`\]]\s*\(/.test(unquotedStrings))throw Error('กรุณาใช้ชื่อฟังก์ชัน SQL แบบไม่ใส่เครื่องหมายครอบ');
 if(/\b(RECURSIVE|ATTACH|DETACH|PRAGMA|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|VACUUM)\b/i.test(tokens))throw Error('SQL นี้มีคำสั่งที่ไม่รองรับในโหมดอ่านข้อมูล');
 const allowed=new Set(['count','sum','avg','min','max','total','lower','upper','length','coalesce','ifnull','nullif','round','abs','substr','substring','trim','ltrim','rtrim','date','time','datetime','strftime','typeof','cast','in','as','over','filter','values','select','exists','not','where','and','or']);
 for(const match of tokens.matchAll(/\b([a-z_]\w*)\s*\(/gi))if(!allowed.has(match[1].toLowerCase()))throw Error('ยังไม่รองรับฟังก์ชัน SQL '+match[1]+' ในรุ่นนี้');
 return sql;
}
