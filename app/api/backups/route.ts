import {NextResponse} from "next/server";
import {withAuth} from "@/lib/auth-api";
import {db,databasePath} from "@/lib/db";
import {listBackups,createBackup} from "@/lib/backups";
import {bad,errorMessage} from "@/lib/api";
export const dynamic="force-dynamic";
export const GET=withAuth(async()=>{try{return NextResponse.json({backups:listBackups(databasePath)});}catch(e){return bad(errorMessage(e));}});
export const POST=withAuth(async()=>{try{return NextResponse.json({backup:createBackup(db,databasePath)});}catch(e){return bad(errorMessage(e));}});
