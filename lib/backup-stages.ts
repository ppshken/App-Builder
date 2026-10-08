import {randomUUID} from "node:crypto";
import {mkdirSync,copyFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {NextResponse} from "next/server";
import {db,databasePath,databaseGeneration,markDatabaseRestored} from "./db";
import {currentUser} from "./permissions";
import {backupFolder,backupFile,inspectBackup,restoreBackup,cleanStage,MAX_BACKUP_BYTES,type RestoreSummary} from "./backups";
import {bad,errorMessage,readBody} from "./api";
type Stage={folder:string;owner:number;path:string;expires:number;generation:number;summary:RestoreSummary};
const globalStages=globalThis as typeof globalThis&{__backupStages?:Map<string,Stage>};
const stages=globalStages.__backupStages??=new Map<string,Stage>();
function expire(){for(const [token,s] of stages)if(s.expires<Date.now()){stages.delete(token);cleanStage(s.folder);}}
function stageFor(token:unknown){expire();const s=typeof token==="string"?stages.get(token):undefined;if(!s||s.owner!==currentUser()?.id||s.path!==databasePath)throw Error("รายการกู้คืนหมดอายุหรือไม่ถูกต้อง กรุณาตรวจไฟล์ใหม่");return s;}
export async function inspectOrRestore(req:Request){let folder="";try{expire();const generation=databaseGeneration();if(Number(req.headers.get("content-length")||0)>MAX_BACKUP_BYTES+1024*1024)return bad("ไฟล์สำรองต้องมีขนาดไม่เกิน 512 MB",413);let b:Record<string,any>={},file:File|undefined;if(req.headers.get("content-type")?.includes("multipart/form-data")){const f=(await req.formData()).get("file");if(!f||typeof f==="string")throw Error("กรุณาเลือกไฟล์สำรอง .db");file=f;if(file.size>MAX_BACKUP_BYTES)throw Error("ไฟล์สำรองต้องมีขนาดไม่เกิน 512 MB");}else b=await readBody(req);
if(b.op==="restore"){if(b.confirmation!=="กู้คืน")throw Error("กรุณาพิมพ์ กู้คืน เพื่อยืนยัน");const s=stageFor(b.token);if(s.generation!==databaseGeneration())throw Error("ฐานข้อมูลถูกกู้คืนไปแล้ว กรุณาตรวจไฟล์ใหม่");stages.delete(b.token);try{const before=restoreBackup(db,databasePath,join(s.folder,"ready.db"));markDatabaseRestored();return NextResponse.json({ok:true,before,redirect:"/login?next="+encodeURIComponent("/?restored=1")});}finally{cleanStage(s.folder);}}
if(stages.size>=4)throw Error("มีไฟล์รอตรวจหลายรายการ กรุณายกเลิกรายการเดิมหรือรอ 15 นาที");folder=join(backupFolder(databasePath),".restore-stage-"+randomUUID());mkdirSync(folder);const source=join(folder,"upload.db");if(file)writeFileSync(source,new Uint8Array(await file.arrayBuffer()));else copyFileSync(backupFile(databasePath,b.name),source);if(generation!==databaseGeneration())throw Error("ฐานข้อมูลถูกกู้คืนระหว่างตรวจไฟล์ กรุณาตรวจใหม่");const summary=inspectBackup(source,join(folder,"ready.db")),token=randomUUID();stages.set(token,{folder,owner:currentUser()!.id,path:databasePath,expires:Date.now()+15*60*1000,generation,summary});folder="";return NextResponse.json({token,summary});
}catch(e){return bad(errorMessage(e));}finally{if(folder)cleanStage(folder);}}
export async function cancelRestore(req:Request){try{const b=await readBody(req),s=stageFor(b.token);stages.delete(b.token);cleanStage(s.folder);return NextResponse.json({ok:true});}catch(e){return bad(errorMessage(e));}}
