import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from "node:crypto";
import type Database from "better-sqlite3";
import {db} from "./db";
const scrypt=(password:string,salt:string,length:number,options:{N:number;r:number;p:number;maxmem:number})=>new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,length,options,(error,hash)=>error?reject(error):resolve(hash)));
export const SESSION_COOKIE="nocode_session";
export const SESSION_AGE=12*60*60*1000;
export const SESSION_IDLE=2*60*60*1000;
export type AuthUser={id:number;name:string;email:string;role:string;avatar?:string};
export class AuthError extends Error {constructor(message:string,public status=400){super(message);}}
export function emailAddress(value:unknown){if(typeof value!=="string" || value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new AuthError("กรุณากรอกอีเมลให้ถูกต้อง");return value.trim().toLowerCase();}
export function validPassword(value:unknown){if(typeof value!=="string"||value.length<10||value.length>128)throw new AuthError("รหัสผ่านต้องมีความยาว 10–128 ตัวอักษร");return value;}
export async function hashPassword(password:string){const salt=randomBytes(16).toString("hex"),hash=await scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024}) as Buffer;return "scrypt-v1:"+salt+":"+hash.toString("hex");}
export async function verifyPassword(password:string,stored:string){const [version,salt,hash]=stored.split(":");if(version!=="scrypt-v1"||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return false;const result=await scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024}) as Buffer;return timingSafeEqual(result,Buffer.from(hash,"hex"));}
export function tokenHash(token:string){return createHash("sha256").update(token).digest("hex");}
export function cookieToken(cookie:string|null){const value=cookie?.split(";").map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+"="))?.slice(SESSION_COOKIE.length+1)||"";return /^[A-Za-z0-9_-]{43}$/.test(value)?value:"";}
export function ownerExists(database:Database.Database=db){return !!database.prepare("SELECT 1 FROM _users LIMIT 1").get();}
export function createSession(user:AuthUser,database:Database.Database=db,now=Date.now()){
 const token=randomBytes(32).toString("base64url");database.prepare("DELETE FROM _sessions WHERE expires_at<=? OR last_seen<=?").run(now,now-SESSION_IDLE);
 database.prepare("INSERT INTO _sessions VALUES(?,?,?,?,?)").run(tokenHash(token),user.id,now,now,now+SESSION_AGE);return {token,user,expiresAt:now+SESSION_AGE};
}
export function sessionUser(token:string,database:Database.Database=db,now=Date.now()):AuthUser|null{
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const row=database.prepare("SELECT u.id,u.name,u.email,u.role,s.last_seen,s.expires_at,u.active FROM _sessions s JOIN _users u ON u.id=s.user_id WHERE s.token_hash=?").get(tokenHash(token)) as AuthUser&{last_seen:number;expires_at:number;active:number}|undefined;
 if(!row)return null;if(!row.active||row.expires_at<=now||row.last_seen<=now-SESSION_IDLE){database.prepare("DELETE FROM _sessions WHERE token_hash=?").run(tokenHash(token));return null;}
 if(now-row.last_seen>=60000)database.prepare("UPDATE _sessions SET last_seen=? WHERE token_hash=?").run(now,tokenHash(token));
 const avatar=(database.prepare("SELECT avatar FROM _user_profiles WHERE user_id=?").get(row.id) as {avatar:string}|undefined)?.avatar;return {id:row.id,name:row.name,email:row.email,role:row.role,...(avatar?{avatar}:{})};
}
export function requestUser(req:Request){return sessionUser(cookieToken(req.headers.get("cookie")));}
export function revokeSession(token:string,database:Database.Database=db){database.prepare("DELETE FROM _sessions WHERE token_hash=?").run(tokenHash(token));}
function throttle(email:string,database:Database.Database){const now=Date.now(),scopes=[['global',20],[tokenHash(email),5]] as const;
 database.transaction(()=>{database.prepare("DELETE FROM _auth_attempts WHERE expires_at<=?").run(now);for(const [scope,limit] of scopes){const previous=database.prepare("SELECT count FROM _auth_attempts WHERE scope=?").get(scope) as {count:number}|undefined;if(previous&&previous.count>=limit)throw new AuthError("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่",429);}
 for(const [scope] of scopes)database.prepare("INSERT INTO _auth_attempts VALUES(?,1,?) ON CONFLICT(scope) DO UPDATE SET count=count+1").run(scope,now+15*60*1000);})();
}
export async function setupOwner(input:Record<string,unknown>,database:Database.Database=db){
 if(ownerExists(database))throw new AuthError("สร้างบัญชีเจ้าของแอปแล้ว กรุณาเข้าสู่ระบบ",409);
 const email=emailAddress(input.email),password=validPassword(input.password);if(typeof input.name!=="string"||!input.name.trim()||input.name.length>100)throw new AuthError("กรุณากรอกชื่อไม่เกิน 100 ตัวอักษร");
 throttle(email,database);const hash=await hashPassword(password);
 return database.transaction(()=>{if(ownerExists(database))throw new AuthError("สร้างบัญชีเจ้าของแอปแล้ว กรุณาเข้าสู่ระบบ",409);const row=database.prepare("INSERT INTO _users(name,email,password_hash,created_at) VALUES(?,?,?,?)").run((input.name as string).trim(),email,hash,Date.now());database.prepare("DELETE FROM _auth_attempts").run();return createSession({id:Number(row.lastInsertRowid),name:(input.name as string).trim(),email,role:"owner"},database);}).immediate();
}
export async function login(input:Record<string,unknown>,database:Database.Database=db){
 const email=emailAddress(input.email);if(typeof input.password!=="string"||input.password.length>128)throw new AuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง",401);throttle(email,database);
 const user=database.prepare("SELECT * FROM _users WHERE email=?").get(email) as AuthUser&{password_hash:string;active:number}|undefined;
 // Do comparable work for unknown accounts rather than revealing registered emails.
 const dummy="scrypt-v1:"+"0".repeat(32)+":"+"0".repeat(128);
 const valid=await verifyPassword(input.password,user?.password_hash||dummy);
 if(!user||!valid||!user.active)throw new AuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง",401);
 database.prepare("DELETE FROM _auth_attempts WHERE scope=?").run(tokenHash(email));return createSession({id:user.id,name:user.name,email:user.email,role:user.role},database);
}
export function assertSameOrigin(req:Request){const origin=req.headers.get("origin"),site=req.headers.get("sec-fetch-site"),target=new URL(req.url);let valid=true;if(origin){try{const source=new URL(origin);valid=source.host===(req.headers.get("host")||target.host)&&source.protocol===target.protocol;}catch{valid=false;}}if(site==="cross-site"||!valid)throw new AuthError("ทำรายการได้จากหน้าแอปนี้เท่านั้น",403);}
