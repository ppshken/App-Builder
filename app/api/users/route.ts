import {NextResponse} from "next/server";
import {withAuth} from "@/lib/auth-api";
import {currentUser} from "@/lib/permissions";
import {usersOverview,manageUsers} from "@/lib/user-management";
import {bad,errorMessage,readBody} from "@/lib/api";
import {AuthError} from "@/lib/auth";
export const dynamic="force-dynamic";
export const GET=withAuth(async()=>NextResponse.json({...usersOverview(),me:currentUser()!.id}));
export const POST=withAuth(async(req:Request)=>{try{return NextResponse.json(await manageUsers(currentUser()!.id,await readBody(req)));}catch(e){const message=e instanceof Error?e.message:"";return bad(e instanceof AuthError?e.message:message.includes("_users.email")?"อีเมลนี้มีบัญชีแล้ว กรุณาใช้อีเมลอื่น":message.includes("_roles.label")?"ชื่อบทบาทนี้มีอยู่แล้ว กรุณาตั้งชื่ออื่น":errorMessage(e),e instanceof AuthError?e.status:400);}});
