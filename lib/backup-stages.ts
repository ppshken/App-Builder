import {APPLICATION_COOKIE} from "./application-context";
import {DRAFT_COOKIE} from "./releases";
import {SESSION_COOKIE} from "./auth";
import {restoreAccountRevision} from "./restore-applications";
import {randomUUID} from "node:crypto";
import {mkdirSync,copyFileSync,writeFileSync,lstatSync} from "node:fs";
import {join} from "node:path";
import {NextResponse} from "next/server";
import {db,databasePath,databaseGeneration,markDatabaseRestored} from "./db";
import {currentUser} from "./permissions";
import {backupFolder,backupFile,inspectBackup,restoreBackup,cleanStage,MAX_BACKUP_BYTES,assertBackupSize,assertBackupDiskSpace,type RestoreSummary} from "./backups";
import {bad,errorMessage,readBody} from "./api";
type Stage={folder:string;owner:number;path:string;expires:number;generation:number;accountsRevision:string;summary:RestoreSummary};
const globalStages=globalThis as typeof globalThis&{__backupStages?:Map<string,Stage>};
const stages=globalStages.__backupStages??=new Map<string,Stage>();
function expire(){for(const [token,s] of stages)if(s.expires<Date.now()){stages.delete(token);cleanStage(s.folder);}}
function stageFor(token:unknown){expire();const s=typeof token==="string"?stages.get(token):undefined;if(!s||s.owner!==currentUser()?.id||s.path!==databasePath)throw Error("รายการกู้คืนหมดอายุหรือไม่ถูกต้อง กรุณาตรวจไฟล์ใหม่");return s;}
export async function inspectOrRestore(req:Request){let folder="";try{expire();const generation=databaseGeneration();if(Number(req.headers.get("content-length")||0)>MAX_BACKUP_BYTES+1024*1024)return bad("ไฟล์สำรองต้องมีขนาดไม่เกิน 512 MB",413);let b:Record<string,any>={},file:File|undefined;if(req.headers.get("content-type")?.includes("multipart/form-data")){const f=(await req.formData()).get("file");if(!f||typeof f==="string")throw Error("กรุณาเลือกไฟล์สำรอง .db");file=f;if(file.size>MAX_BACKUP_BYTES)throw Error("ไฟล์สำรองต้องมีขนาดไม่เกิน 512 MB");}else b=await readBody(req);
if(b.op==="restore"){if(b.confirmation!=="กู้คืน")throw Error("กรุณาพิมพ์ กู้คืน เพื่อยืนยัน");const s=stageFor(b.token);if(s.accountsRevision!==restoreAccountRevision(db))throw Error("บัญชีผู้ใช้เปลี่ยนหลังตรวจไฟล์ กรุณาตรวจไฟล์ใหม่เพื่อจับคู่สิทธิ์อีกครั้ง");if(s.generation!==databaseGeneration())throw Error("ฐานข้อมูลถูกกู้คืนไปแล้ว กรุณาตรวจไฟล์ใหม่");stages.delete(b.token);try{const before=restoreBackup(db,databasePath,join(s.folder,"ready.db"));markDatabaseRestored();const response=NextResponse.json({ok:true,before,redirect:"/login?next="+encodeURIComponent("/?restored=1")});response.cookies.set(APPLICATION_COOKIE,'default',{httpOnly:true,sameSite:'strict',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:43200});for(const cookie of [DRAFT_COOKIE,SESSION_COOKIE])response.cookies.set(cookie,'',{httpOnly:true,sameSite:cookie===SESSION_COOKIE?'lax':'strict',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:0});return response;}finally{cleanStage(s.folder);}}
if(stages.size>=4)throw Error("มีไฟล์รอตรวจหลายรายการ กรุณายกเลิกรายการเดิมหรือรอ 15 นาที");
const namedFile=file?undefined:backupFile(databasePath,b.name),size=namedFile?lstatSync(namedFile).size:file!.size;
assertBackupSize(size,!!namedFile);assertBackupDiskSpace(databasePath,size*2);
folder=join(backupFolder(databasePath),".restore-stage-"+randomUUID());mkdirSync(folder,{mode:0o700});
const source=join(folder,"upload.db");
if(namedFile)copyFileSync(namedFile,source);else if(file)writeFileSync(source,new Uint8Array(await file.arrayBuffer()),{mode:0o600});
if(generation!==databaseGeneration())throw Error("ฐานข้อมูลถูกกู้คืนระหว่างตรวจไฟล์ กรุณาตรวจใหม่");
const summary=inspectBackup(source,join(folder,"ready.db"),db,false,!!namedFile),token=randomUUID();
stages.set(token,{folder,owner:currentUser()!.id,path:databasePath,expires:Date.now()+15*60*1000,generation,accountsRevision:restoreAccountRevision(db),summary});
folder="";return NextResponse.json({token,summary});
}catch(e){return bad(errorMessage(e));}finally{if(folder)cleanStage(folder);}}
export async function cancelRestore(req:Request){try{const b=await readBody(req),s=stageFor(b.token);stages.delete(b.token);cleanStage(s.folder);return NextResponse.json({ok:true});}catch(e){return bad(errorMessage(e));}}
