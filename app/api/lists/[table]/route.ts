import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import { NextResponse } from "next/server";
import { listPage } from "@/lib/lists";
import { bad, errorMessage, readBody } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handleGET(req: Request, {params}: {params:{table:string}}) {
  try {
    const email = req.headers.get("x-nocode-preview-email") || "";
    if (email && (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("อีเมลสำหรับ Preview ไม่ถูกต้อง");
    return NextResponse.json(listPage(params.table,new URL(req.url).searchParams,email.toLowerCase()));
  } catch(e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePOST(req: Request, {params}: {params:{table:string}}) {
  try {
    const {keys} = await readBody(req), email = req.headers.get("x-nocode-preview-email") || "";
    if (keys === undefined) throw new Error("กรุณาระบุรายการคีย์");
    if (email && (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("อีเมลสำหรับ Preview ไม่ถูกต้อง");
    return NextResponse.json(listPage(params.table,new URL(req.url).searchParams,email.toLowerCase(),keys));
  } catch(e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
