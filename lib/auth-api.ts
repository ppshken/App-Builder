import {NextResponse} from "next/server";
import {db} from "./db";
import {requestUser,assertSameOrigin,AuthError} from "./auth";
import {accessFor,runAuthorized,assertTablePermission,canExecuteAction,assertImageAccess} from "./permissions";
export function withAuth(handler:(...args:any[])=>Promise<Response>){return async(req:Request,context:any)=>{
 try{
  const user=requestUser(req);if(!user)return NextResponse.json({error:"กรุณาเข้าสู่ระบบก่อนใช้งาน"},{status:401,headers:{"Cache-Control":"no-store"}});
  const access=accessFor(user);
  return await runAuthorized(user,access,async()=>{
   const url=new URL(req.url),path=url.pathname,read=req.method==="GET"||req.method==="HEAD";
   if(!read)assertSameOrigin(req);
   if(path==="/api/user-settings"){if(!read&&req.method!=="PUT"&&!access.owner)throw new AuthError("เจ้าของแอปเท่านั้นที่กำหนดค่าตั้งค่าผู้ใช้ได้",403);}
   else if(path.startsWith("/api/users")||path.startsWith("/api/backups")){if(!access.owner)throw new AuthError("ส่วนนี้สำหรับเจ้าของแอปเท่านั้น",403);}
   else if(path.startsWith("/api/excel/")){assertTablePermission(context?.params?.table,"read");if(!read&&!access.owner&&!access.builder&&!access.tables[context?.params?.table]?.create&&!access.tables[context?.params?.table]?.update)throw new AuthError("ไม่มีสิทธิ์นำเข้าข้อมูล",403);}
   else if(path.startsWith("/api/data/")){const table=context?.params?.table;if(path.endsWith("/validate")){assertTablePermission(table,"read");if(!access.owner&&!access.builder&&!access.tables[table]?.create&&!access.tables[table]?.update)throw new AuthError("ไม่มีสิทธิ์ตรวจข้อมูลก่อนบันทึก",403);}else if(path.endsWith("/clear")){if(!access.builder&&!access.owner)throw new AuthError("ไม่มีสิทธิ์เคลียร์ทั้งตาราง",403);assertTablePermission(table,"delete");}else assertTablePermission(table,read?"read":req.method==="POST"?"create":req.method==="PUT"?"update":"delete");if(!read)assertTablePermission(table,"read");if(read&&url.searchParams.get("defaults")==="1")assertTablePermission(table,"create");}
   else if(path.startsWith("/api/lists/")){assertTablePermission(context?.params?.table,"read");const owner=url.searchParams.get("owner");if(owner)assertTablePermission(owner,"read");}
   else if(path==="/api/actions"&&!read){const body=req.method==="POST"?await req.clone().json().catch(()=>{throw new AuthError("รูปแบบข้อมูลไม่ถูกต้อง",400);}):{};if(body.op==="execute"){const action=db.prepare("SELECT name,table_name,kind FROM _actions WHERE name=?").get(body.name) as any;if(!action||!canExecuteAction(action))throw new AuthError("ไม่มีสิทธิ์ใช้ Action นี้",403);}else if(!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);}
   else if(path.startsWith("/api/images/"))assertImageAccess(context?.params?.id);
   else if(path==="/api/images"){if(!access.builder&&!Object.values(access.tables).some(t=>t.read&&(t.create||t.update)))throw new AuthError("ไม่มีสิทธิ์อัปโหลดรูปภาพ",403);}
   else if(path==="/api/expression-data"){const table=url.searchParams.get("table");if(table)assertTablePermission(table,"read");if(!read&&!access.builder)throw new AuthError("ไม่มีสิทธิ์ทดสอบสูตรของแอป",403);}
   else if(!read&&!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);
   else if(path.startsWith("/api/tables/")&&!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);
   const headers=new Headers(req.headers);headers.set("x-nocode-preview-email",user.email);
   const response=await handler(new Request(req,{headers}),context);response.headers.set("Cache-Control","private, no-store");return response;
  });
 }catch(e){if(!(e instanceof AuthError))console.error(e);return NextResponse.json({error:e instanceof AuthError?e.message:"ตรวจสิทธิ์ไม่ได้ กรุณาลองใหม่"},{status:e instanceof AuthError?e.status:500,headers:{"Cache-Control":"no-store"}});}
};}
