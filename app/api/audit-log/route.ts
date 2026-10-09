import {NextResponse} from "next/server";
import {withAuth} from "@/lib/auth-api";
import {readAuditLog} from "@/lib/audit-log";
import {currentAccess} from "@/lib/permissions";
import {AuthError} from "@/lib/auth";
import {bad,errorMessage,errorStatus} from "@/lib/api";
export const dynamic="force-dynamic";
export const GET=withAuth(async(req:Request)=>{try{if(!currentAccess().owner)throw new AuthError("ประวัติการแก้ไขสำหรับเจ้าของแอปเท่านั้น",403);return NextResponse.json(readAuditLog(new URL(req.url).searchParams));}catch(e){return bad(errorMessage(e),errorStatus(e));}});
