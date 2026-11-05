import {parseExpression,evaluateExpression,type ExpressionOptions,type Value} from "./expression";
export function imageFolder(value:unknown,allowEmpty=true):string{if(typeof value!=="string")throw Error("Path รูปภาพต้องเป็นข้อความ เช่น products/photos");const path=value.trim().replace(/\\/g,"/");if(!path&&allowEmpty)return "";if(!path||path.length>160||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..'||!/^[a-zA-Z0-9_-]+$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(p)))throw Error("Path ใช้ชื่อโฟลเดอร์ภาษาอังกฤษ ตัวเลข _ หรือ - คั่นด้วย / เช่น products/photos และห้ามใช้ .. หรือไดรฟ์ C:");return path;}
export function iconImageUrl(value:unknown):string{if(typeof value!=="string"||value.length>2000)throw Error("ลิงก์ไอคอนต้องเป็นข้อความไม่เกิน 2,000 ตัวอักษร");const text=value.trim();if(!text||/^\/api\/images\/[a-f0-9-]{36}$/.test(text))return text;try{const url=new URL(text);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}throw Error("ไอคอนต้องเป็นรูปที่อัปโหลด หรือ URL ที่ขึ้นต้นด้วย https:// หรือ http://");}

// Keep literal paths backward compatible; expressions use the existing bounded interpreter.
export function imagePathIsExpression(value:string){return /^(?:=|\[|["']|[A-Z_][A-Z0-9_]*\s*\()/i.test(value.trim());}
export function imagePathSetting(value:unknown):string{
 if(typeof value!=='string'||value.length>2000)throw Error('Path หรือสูตรโฟลเดอร์รูปภาพต้องเป็นข้อความไม่เกิน 2,000 ตัวอักษร');
 const source=value.trim();if(!imagePathIsExpression(source))return imageFolder(source);
 parseExpression(source.startsWith('=')?source.slice(1):source);return source;
}
export function resolveImageFolder(setting:string,fallback:string,row:Record<string,Value>,options:ExpressionOptions={}):string{
 const source=imagePathSetting(setting||'');if(!source)return imageFolder(fallback,false);
 if(!imagePathIsExpression(source))return imageFolder(source,false);
 const result=evaluateExpression(source.startsWith('=')?source.slice(1):source,row,options);
 if(typeof result!=='string'&&typeof result!=='number'||typeof result==='number'&&!Number.isFinite(result))throw Error('Path จากสูตรต้องเป็นข้อความหรือตัวเลขหนึ่งค่า');
 return imageFolder(String(result),false);
}
