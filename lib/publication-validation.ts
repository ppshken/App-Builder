import {releaseRevisionStamp} from './release-data-revisions';
import {fork} from 'node:child_process';
import {existsSync} from 'node:fs';
import {rmSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validApplicationId} from './application-context';
import type Database from 'better-sqlite3';
import {AuthError} from './auth';
import type {RehearsalResult} from './release-rehearsal';
export class PublicationValidationError extends AuthError{constructor(public result:RehearsalResult){super('ตรวจข้อมูลล่าสุดไม่ผ่าน ไม่มีการเผยแพร่ ดูจุดที่ข้อมูลไม่ผ่านด้านล่าง',409);}}
export function publicationDataStamp(database:Database.Database,names:string[]){return releaseRevisionStamp(database,names);}
export function validatePublicationInWorker(input:{databasePath:string;workspaceId:string;appId:string;owner:number;planHash:string},pulse:()=>void,aborted:()=>boolean){
 if(!validApplicationId(input.appId)||!/^[a-f0-9-]{36}$/.test(input.workspaceId))throw new AuthError('บริบทพื้นที่พัฒนาไม่ถูกต้อง',409);
 const jobId=randomUUID(),root=resolve(dirname(input.databasePath),'.app-releases',input.appId==='default'?'':input.appId,input.workspaceId),scratch=resolve(root,'rehearsal-'+jobId);
 const worker=resolve('.rehearsal-worker','publication-validation-worker-entry.js');
 if(!existsSync(worker))throw new AuthError('ยังไม่ได้ Build ตัวตรวจเผยแพร่ กรุณา Build หรือเปิด dev ใหม่',409);
 return new Promise<RehearsalResult>((resolveResult,reject)=>{
  const options:import('node:child_process').ForkOptions&{windowsHide:true}={windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],execArgv:['--max-old-space-size=512'],env:{...process.env,NOCODE_DB_PATH:input.databasePath}};
  const child=fork(worker,[],options);
  let result:RehearsalResult|undefined,error:Error|undefined;
  const stop=(e:Error)=>{error=e;child.kill();};
  const timer=setTimeout(()=>stop(new AuthError('หมดเวลาตรวจข้อมูลก่อนเผยแพร่ ไม่มีการเปลี่ยนข้อมูลจริง',409)),16*60000);
  const heartbeat=setInterval(()=>{try{if(aborted())throw new AuthError('ยกเลิกการตรวจเผยแพร่แล้ว',409);pulse();}catch(e){stop(e as Error);}},1000);
  child.on('message',message=>{const m=message as {result?:RehearsalResult};if(m.result?.workspaceId===input.workspaceId&&m.result.appId===input.appId&&m.result.planHash===input.planHash)result=m.result;});
  child.on('error',()=>{error=new AuthError('เปิดตัวตรวจเผยแพร่ไม่สำเร็จ กรุณาตรวจ Build',409);});
  child.once('close',()=>{clearTimeout(timer);clearInterval(heartbeat);if(relative(root,scratch)==='rehearsal-'+jobId)try{rmSync(scratch,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}if(error)reject(error);else if(result)resolveResult(result);else reject(new AuthError('ตัวตรวจเผยแพร่หยุดก่อนเสร็จ ไม่มีการเปลี่ยนข้อมูลจริง',409));});
  child.send({workspaceId:input.workspaceId,appId:input.appId,owner:input.owner,planHash:input.planHash,jobId},error=>{if(error)stop(new AuthError('ส่งงานตรวจเผยแพร่ไม่สำเร็จ',409));});
 });
}
