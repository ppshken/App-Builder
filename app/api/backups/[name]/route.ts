import {NextResponse} from "next/server";
import {readFileSync} from "node:fs";
import {withAuth} from "@/lib/auth-api";
import {databasePath} from "@/lib/db";
import {backupFile} from "@/lib/backups";
import {bad,errorMessage} from "@/lib/api";
export const dynamic="force-dynamic";
export const GET=withAuth(async(_req:Request,{params}:{params:{name:string}})=>{try{return new NextResponse(new Uint8Array(readFileSync(backupFile(databasePath,params.name))),{headers:{"Content-Type":"application/vnd.sqlite3","Content-Disposition":'attachment; filename="'+params.name+'"'}});}catch(e){return bad(errorMessage(e));}});
