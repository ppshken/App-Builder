const LOCAL_IMAGE=/^\/api\/images\/[a-f0-9-]{36}$/;
export function isRemoteImageSource(value:unknown):value is string{
 if(typeof value!=='string'||value.length>2000||!/^https?:\/\//i.test(value)||/[\\\u0000-\u0020\u007f]/.test(value))return false;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
export function normalizeImageSource(value:string){const text=value.trim();if(LOCAL_IMAGE.test(text))return text;if(isRemoteImageSource(text))return new URL(text).href;throw Error('ต้องเป็นรูปภาพที่อัปโหลด หรือ URL รูปภาพที่ขึ้นต้นด้วย https:// หรือ http:// และไม่มีชื่อผู้ใช้หรือรหัสผ่าน');}
