import {db} from '@/lib/db';
import {requestUser,assertSameOrigin,AuthError,validPassword,verifyPassword,hashPassword,cookieToken,tokenHash} from '@/lib/auth';
import {authResponse,authFailure} from '@/lib/auth-response';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=requestUser(req);if(!user)throw new AuthError('กรุณาเข้าสู่ระบบ',401);const role=db.prepare('SELECT label FROM _roles WHERE name=?').get(user.role) as {label:string}|undefined;return authResponse(req,{user,roleLabel:role?.label||user.role,active:true});}catch(e){return authFailure(e);}}
export async function PATCH(req:Request){try{assertSameOrigin(req);const user=requestUser(req);if(!user)throw new AuthError('กรุณาเข้าสู่ระบบ',401);if(Number(req.headers.get('content-length'))>300000)throw new AuthError('รูปภาพใหญ่เกินไป');const text=await req.text();if(text.length>300000)throw new AuthError('รูปภาพใหญ่เกินไป');const input=JSON.parse(text);if(input.op==='password'){
 const password=validPassword(input.password);if(typeof input.currentPassword!=='string'||input.currentPassword.length>128)throw new AuthError('กรุณากรอกรหัสผ่านเดิม');
 // Reuse the login throttle, including its global and per-account limits.
 const {login,revokeSession}=await import('@/lib/auth');const checked=await login({email:user.email,password:input.currentPassword});revokeSession(checked.token);
 const previous=db.prepare('SELECT password_hash FROM _users WHERE id=? AND active=1').get(user.id) as {password_hash:string}|undefined;
 if(!previous||!await verifyPassword(input.currentPassword,previous.password_hash))throw new AuthError('รหัสผ่านเดิมไม่ถูกต้อง');const hash=await hashPassword(password);
 db.transaction(()=>{if(db.prepare('UPDATE _users SET password_hash=? WHERE id=? AND active=1 AND password_hash=?').run(hash,user.id,previous.password_hash).changes!==1)throw new AuthError('บัญชีมีการเปลี่ยนแปลง กรุณาลองใหม่',409);db.prepare('DELETE FROM _sessions WHERE user_id=? AND token_hash<>?').run(user.id,tokenHash(cookieToken(req.headers.get('cookie'))));})();return authResponse(req,{ok:true});
 }
 if(input.op!=='profile'||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>100)throw new AuthError('กรุณากรอกชื่อไม่เกิน 100 ตัวอักษร');
 const avatar=input.avatar;if(typeof avatar!=='string'||avatar.length>280000||avatar!==''&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar))throw new AuthError('รูปโปรไฟล์ต้องเป็น JPG PNG หรือ WebP ขนาดไม่เกิน 200 KB');
 db.transaction(()=>{db.prepare('UPDATE _users SET name=? WHERE id=? AND active=1').run(input.name.trim(),user.id);db.prepare('INSERT INTO _user_profiles(user_id,avatar) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar').run(user.id,avatar);})();return GET(req);
 }catch(e){return authFailure(e);}}
