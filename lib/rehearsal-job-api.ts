import {existsSync} from 'node:fs';
import {databasePath} from './db';
import {currentApplication} from './application-context';
import {draftManifest,reviewedDraft,isDevelopmentDraft} from './releases';
import {AuthError} from './auth';
import {openRehearsalQueue,rehearsalQueuePath,enqueueRehearsal,cancelRehearsal,latestRehearsalJob} from './rehearsal-jobs';
import {startRehearsalSupervisor,rehearsalWorkerFile} from './rehearsal-supervisor';
export function queueRehearsal(id:string,owner:number,planHash:string,mode:"sample"|"full"="full"){
 if(!["sample","full"].includes(mode))throw new AuthError("รูปแบบการซ้อมไม่ถูกต้อง",400);
 const review=reviewedDraft(id,owner);if(!isDevelopmentDraft(review.manifest)||review.rehearsal_hash!==planHash)throw new AuthError('แผนเปลี่ยนหรือไม่ใช่พื้นที่พัฒนา กรุณาตรวจใหม่',409);
 if(!existsSync(rehearsalWorkerFile()))throw new AuthError('ยังไม่ได้ Build ตัวทำงานซ้อม กรุณารัน Build ของระบบก่อน',409);
 const q=openRehearsalQueue(rehearsalQueuePath(databasePath));try{enqueueRehearsal(q,{appId:currentApplication()!.id,workspaceId:id,owner,planHash,mode});}finally{q.close();}startRehearsalSupervisor();return rehearsalJobStatus(id,owner);
}
export function rehearsalJobStatus(id:string,owner:number){draftManifest(id,owner);const path=rehearsalQueuePath(databasePath);if(!existsSync(path))return null;const q=openRehearsalQueue(path);try{const j=latestRehearsalJob(q,currentApplication()!.id,id,owner);if(!j)return null;return {id:j.id,planHash:j.plan_hash,mode:j.mode||"full",status:j.status,stage:j.stage,processed:j.processed,total:j.total,cancelRequested:!!j.cancel_requested,createdAt:j.created_at,updatedAt:j.updated_at,result:j.result_json?JSON.parse(j.result_json):null,freshness:'snapshot-only'};}finally{q.close();}}
export function requestRehearsalCancellation(id:string,owner:number,jobId:string){draftManifest(id,owner);const q=openRehearsalQueue(rehearsalQueuePath(databasePath));try{cancelRehearsal(q,jobId,currentApplication()!.id,id,owner);}finally{q.close();}return rehearsalJobStatus(id,owner);}
