import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {db,databasePath,tableExists,columnsOf} from "@/lib/db";
import {bad,errorMessage,readBody} from "@/lib/api";
import {createBackup} from "@/lib/backups";
import {ConversionRequest,conversionFingerprint,previewConversion,applyConversion} from "@/lib/column-conversion";
export const dynamic="force-dynamic";
type Pending={table:string;path:string;request:ConversionRequest;fingerprint:string;expires:number};
const state=globalThis as typeof globalThis&{__nocodeConversions?:Map<string,Pending>};
const pending=state.__nocodeConversions ||= new Map<string,Pending>();
function expire(){for(const [key,item] of pending)if(item.expires<Date.now())pending.delete(key);}
function sameOrigin(req:Request){const origin=req.headers.get("origin"),url=new URL(req.url);if(origin&&(new URL(origin).host!==(req.headers.get("host")||url.host)||new URL(origin).protocol!==url.protocol))throw Error("แปลงข้อมูลได้จากหน้าแอพนี้เท่านั้น");}
async function handlePOST(req:Request,{params}:{params:{name:string}}){try{
 sameOrigin(req);expire();if(!tableExists(params.name))return bad("ไม่พบตาราง",404);
 const body=await readBody(req);if(body.previous_token)pending.delete(body.previous_token);
 if(body.source_type&&columnsOf(params.name).find(c=>c.name===body.column)?.type!==body.source_type)return bad("ชนิดคอลัมน์เปลี่ยนไปแล้ว กรุณาโหลดหน้าตารางใหม่ก่อนตรวจการแปลง",409);
 if(pending.size>=30)throw Error("มีผลตรวจรอยืนยันหลายรายการ กรุณาปิดรายการเก่าหรือรอ 15 นาที");
 const request:ConversionRequest={column:body.column,mode:body.mode,target:body.target,ref_match:body.ref_match},fingerprint=conversionFingerprint(db,params.name,request),report=previewConversion(db,params.name,request);
 const token=report.allowed?randomUUID():"";if(token)pending.set(token,{table:params.name,path:databasePath,request,fingerprint,expires:Date.now()+15*60*1000});
 return NextResponse.json({token,report});
 }catch(e){return bad(errorMessage(e),errorStatus(e));}}
async function handlePUT(req:Request,{params}:{params:{name:string}}){try{
 sameOrigin(req);expire();const body=await readBody(req);if(body.confirmation!=="แปลง")throw Error("กรุณาพิมพ์ แปลง เพื่อยืนยันเปลี่ยนข้อมูล");
 const item=pending.get(body.token);if(!item||item.table!==params.name||item.path!==databasePath)throw Error("ผลตรวจหมดอายุ กรุณาตรวจการแปลงใหม่");
 if(item.fingerprint!==conversionFingerprint(db,item.table,item.request)){pending.delete(body.token);return bad("ข้อมูลหรือการตั้งค่าเปลี่ยนหลังตรวจ กรุณาตรวจการแปลงใหม่ก่อนยืนยัน",409);}
 const report=previewConversion(db,item.table,item.request);if(!report.allowed){pending.delete(body.token);return NextResponse.json({error:"ผลตรวจเปลี่ยนไป กรุณาตรวจการแปลงใหม่",report},{status:409});}
 const backup=createBackup(db,databasePath,"schema"),column=applyConversion(db,item.table,item.request,item.fingerprint);pending.delete(body.token);
 return NextResponse.json({ok:true,column,backup,rows:report.total,mode:item.request.mode});
 }catch(e){return bad(errorMessage(e),errorStatus(e));}}
async function handleDELETE(req:Request,{params}:{params:{name:string}}){try{sameOrigin(req);const body=await readBody(req),item=pending.get(body.token);if(item?.table===params.name&&item.path===databasePath)pending.delete(body.token);return NextResponse.json({ok:true});}catch(e){return bad(errorMessage(e),errorStatus(e));}}

export const POST = withAuth(handlePOST);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);
