import {createReadStream,lstatSync} from "node:fs";
import {Readable} from "node:stream";
import {withAuth} from "@/lib/auth-api";
import {databasePath} from "@/lib/db";
import {backupFile} from "@/lib/backups";
import {bad,errorMessage} from "@/lib/api";
export const dynamic="force-dynamic";
export const GET=withAuth(async(req:Request,{params}:{params:{name:string}})=>{
 try {
  const path=backupFile(databasePath,params.name),size=lstatSync(path).size;
  const stream=createReadStream(path,{signal:req.signal});
  return new Response(Readable.toWeb(stream) as ReadableStream,{headers:{
   "Content-Type":"application/vnd.sqlite3","Content-Length":String(size),"Cache-Control":"no-store",
   "Content-Disposition":'attachment; filename="'+params.name+'"',
  }});
 }catch(e){return bad(errorMessage(e));}
});
