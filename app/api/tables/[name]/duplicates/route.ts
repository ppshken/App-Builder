import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import {NextResponse} from "next/server";
import {db,columnsOf,tableExists} from "@/lib/db";
import {duplicateGroups} from "@/lib/unique";
import {bad,errorMessage} from "@/lib/api";
export const dynamic="force-dynamic";
async function handleGET(req:Request,{params}:{params:{name:string}}){try{
 if(!tableExists(params.name))return bad("ไม่พบตาราง",404);const column=columnsOf(params.name).find(c=>c.name===new URL(req.url).searchParams.get("column"));if(!column)throw Error("กรุณาเลือกคอลัมน์ที่ต้องการตรวจ");
 return NextResponse.json({...duplicateGroups(db,params.name,column),column});
 }catch(e){return bad(errorMessage(e),errorStatus(e));}}

export const GET = withAuth(handleGET);
