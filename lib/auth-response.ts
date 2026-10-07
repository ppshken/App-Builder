import {NextResponse} from "next/server";
import {SESSION_COOKIE,SESSION_AGE,AuthError} from "./auth";
export function authResponse(req:Request,data:unknown,token?:string){const response=NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});if(token!==undefined)response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:new URL(req.url).protocol==="https:",path:"/",maxAge:token?SESSION_AGE/1000:0});return response;}
export function authFailure(error:unknown){return NextResponse.json({error:error instanceof AuthError?error.message:"ทำรายการไม่ได้ กรุณาลองใหม่"},{status:error instanceof AuthError?error.status:400,headers:{"Cache-Control":"no-store"}});}
