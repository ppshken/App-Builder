import {withUsageRequest} from '@/lib/app-usage';
import {landingPage} from "@/lib/landing-page";
import {login,assertSameOrigin} from "@/lib/auth";import {authResponse,authFailure} from "@/lib/auth-response";import {readBody} from "@/lib/api";
export const dynamic="force-dynamic";
export async function POST(req:Request){return withUsageRequest(req,async()=>{try{assertSameOrigin(req);const result=await login(await readBody(req));return authResponse(req,{user:result.user,redirectTo:landingPage(result.user)},result.token);}catch(e){return authFailure(e);}});}
