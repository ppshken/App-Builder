import {requestUser,ownerExists} from "@/lib/auth";import {authResponse,authFailure} from "@/lib/auth-response";
import {accessFor} from "@/lib/permissions";import {NO_ACCESS} from "@/lib/access";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const user=requestUser(req);return authResponse(req,{user,needsSetup:!ownerExists(),access:user?accessFor(user):NO_ACCESS});}catch(e){return authFailure(e);}}
