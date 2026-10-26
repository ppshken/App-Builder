import {applicationCookie,withApplication,ApplicationBoundaryError} from './application-context';
import {applicationScopeFor} from './applications';
import {draftCookie} from "./releases";
import {withDraftRequest} from "./draft-request";
import {withAuditActor} from "./audit-context";
import {NextResponse} from "next/server";
import {db} from "./db";
import {requestUser,assertSameOrigin,AuthError} from "./auth";
import {accessFor,runAuthorized,assertExcelExport,assertTablePermission,canExecuteAction,assertFileAccess,assertImageAccess} from "./permissions";
export function withAuth(handler:(...args:any[])=>Promise<Response>){return async(req:Request,context:any)=>{
 try{
  const user=requestUser(req);if(!user)return NextResponse.json({error:"กรุณาเข้าสู่ระบบก่อนใช้งาน"},{status:401,headers:{"Cache-Control":"no-store"}});
  const pathName=new URL(req.url).pathname,platform=['/api/applications','/api/users','/api/backups','/api/audit-log','/api/auth/'].some(p=>pathName===p||pathName.startsWith(p+'/'));
  const application=platform?undefined:applicationScopeFor(user,applicationCookie(req.headers.get('cookie'))),expected=req.headers.get('x-nocode-app')||(pathName==='/api/realtime'?new URL(req.url).searchParams.get('app'):null);if(application&&expected&&expected!==application.id)throw new AuthError('แอปเปลี่ยน กรุณาโหลดหน้าใหม่ก่อนทำรายการ',409);
  const run=async()=>{const access=accessFor(user);
  return await runAuthorized(user,access,()=>withDraftRequest(req,user,access,async()=>{
   const url=new URL(req.url),path=url.pathname,read=req.method==="GET"||req.method==="HEAD";
   if(!read)assertSameOrigin(req);
   if(path.startsWith("/api/workflows")||path.startsWith("/api/pdf-templates")){if(!(read&&path==="/api/workflows"&&(url.searchParams.get("runtime")==="1"||url.searchParams.get("activity")==="1"))&&!access.builder)throw new AuthError("ผู้พัฒนาแอปเท่านั้นที่จัดการ Automation และแม่แบบ PDF ได้",403);}
   else if(path==="/api/user-settings"){if(!read&&req.method!=="PUT"&&!access.builder)throw new AuthError("ผู้พัฒนาแอปเท่านั้นที่กำหนดค่าตั้งค่าผู้ใช้ได้",403);}
   else if(path.startsWith("/api/users")||path.startsWith("/api/backups")||path.startsWith("/api/audit-log")){if(!access.owner)throw new AuthError("ส่วนนี้สำหรับเจ้าของแอปเท่านั้น",403);}
   else if(path.startsWith("/api/excel/")){assertTablePermission(context?.params?.table,"read");if(read&&url.searchParams.get("template")!=="1")assertExcelExport(context?.params?.table);if(!read&&!access.owner&&!access.builder&&!access.tables[context?.params?.table]?.create&&!access.tables[context?.params?.table]?.update)throw new AuthError("ไม่มีสิทธิ์นำเข้าข้อมูล",403);}
   else if(path.startsWith("/api/data/")){const table=context?.params?.table;if(path.endsWith("/validate")){assertTablePermission(table,"read");if(!access.owner&&!access.builder&&!access.tables[table]?.create&&!access.tables[table]?.update)throw new AuthError("ไม่มีสิทธิ์ตรวจข้อมูลก่อนบันทึก",403);}else if(path.endsWith("/clear")){if(!access.builder&&!access.owner)throw new AuthError("ไม่มีสิทธิ์เคลียร์ทั้งตาราง",403);assertTablePermission(table,"delete");}else assertTablePermission(table,read?"read":req.method==="POST"?"create":req.method==="PUT"?"update":"delete");if(!read)assertTablePermission(table,"read");if(read&&url.searchParams.get("defaults")==="1")assertTablePermission(table,"create");}
   else if(path.startsWith("/api/lists/")){assertTablePermission(context?.params?.table,"read");const owner=url.searchParams.get("owner");if(owner)assertTablePermission(owner,"read");}
   else if(path==="/api/actions"&&!read){const body=req.method==="POST"?await req.clone().json().catch(()=>{throw new AuthError("รูปแบบข้อมูลไม่ถูกต้อง",400);}):{};if(body.op==="execute"){const action=db.prepare("SELECT name,table_name,kind FROM _actions WHERE name=?").get(body.name) as any;if(!action||!canExecuteAction(action))throw new AuthError("ไม่มีสิทธิ์ใช้ Action นี้",403);}else if(!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);}
   else if(path.startsWith("/api/files/"))assertFileAccess(context?.params?.id);
   else if(path==="/api/files"){if(!access.builder&&!Object.values(access.tables).some(t=>t.read&&(t.create||t.update)))throw new AuthError("ไม่มีสิทธิ์อัปโหลดไฟล์",403);}
   else if(path.startsWith("/api/images/"))assertImageAccess(context?.params?.id);
   else if(path==="/api/images"){if(!access.builder&&!Object.values(access.tables).some(t=>t.read&&(t.create||t.update)))throw new AuthError("ไม่มีสิทธิ์อัปโหลดรูปภาพ",403);}
   else if(path==="/api/expression-data"){const table=url.searchParams.get("table");if(table)assertTablePermission(table,"read");if(!read&&!access.builder)throw new AuthError("ไม่มีสิทธิ์ทดสอบสูตรของแอป",403);}
   else if(path==='/api/applications'){}
   else if(!read&&!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);
   else if(path.startsWith("/api/tables/")&&!access.builder)throw new AuthError("ไม่มีสิทธิ์แก้ไขแอป",403);
   const headers=new Headers(req.headers);headers.set("x-nocode-preview-email",user.email);
   if(path.startsWith('/api/tables/')){const table=context?.params?.name;assertTablePermission(table,'read');if(!read&&application){const owner=(db.prepare('SELECT owner_app_id FROM _tables WHERE name=?').get(table) as {owner_app_id:string}|undefined)?.owner_app_id;if(owner!==application.id)throw new AuthError('แก้โครงสร้างตารางร่วมจากแอปเจ้าของตารางเท่านั้น',403);const shared=!!db.prepare('SELECT 1 FROM _application_datasets WHERE table_name=? AND app_id<>? AND can_read=1').get(table,application.id);const body=req.method==='PATCH'?await req.clone().json():null;if(shared&&(!body||!['label','realtime','add_column'].includes(body.op)))throw new AuthError('ตารางนี้ใช้ร่วมกับแอปอื่น กรุณาตรวจและยกเลิกการเชื่อมก่อนเปลี่ยนโครงสร้างหรือลบตาราง',409);}}

   const response=await withAuditActor(user,(application&&application.id!=='default'?'app:'+application.id+' ':'')+path,()=>handler(new Request(req,{headers}),context));response.headers.set("Cache-Control",response.headers.get("Content-Type")?.startsWith("text/event-stream")?"private, no-store, no-transform":"private, no-store");if(application)response.headers.set('X-Nocode-App',application.id);response.headers.set("X-Nocode-Workspace",access.builder?(draftCookie(req)||"live"):"live");return response;
  }));};return application?await withApplication(application,run):await run();
 }catch(e){if(!(e instanceof AuthError))console.error(e);return NextResponse.json({error:(e instanceof AuthError||e instanceof ApplicationBoundaryError)?e.message:"ตรวจสิทธิ์ไม่ได้ กรุณาลองใหม่"},{status:(e instanceof AuthError||e instanceof ApplicationBoundaryError)?e.status:500,headers:{"Cache-Control":"no-store"}});}
};}
