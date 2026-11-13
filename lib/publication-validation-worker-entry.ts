import Database from 'better-sqlite3';
import {databasePath,withDatabase} from './db';
import {withApplication} from './application-context';
import {applicationScopeFor} from './applications';
import {accessFor,runAuthorized} from './permissions';
import {withAuditActor} from './audit-context';
import {rehearseDraft} from './releases';
import type {AuthUser} from './auth';
// Uses the existing rehearsal engine. Main database is opened read-only.
process.on('disconnect',()=>process.exit(1));
process.once('message',async message=>{
 const input=message as {workspaceId:string;appId:string;owner:number;planHash:string;jobId:string};
 let source:Database.Database|undefined;
 try{
  if(!/^[a-f0-9-]{36}$/.test(input.workspaceId)||!/^[a-f0-9-]{36}$/.test(input.jobId)||!Number.isSafeInteger(input.owner)||!/^[a-f0-9]{64}$/.test(input.planHash))throw Error('Invalid validation context');
  source=new Database(databasePath,{readonly:true,fileMustExist:true});
  const result=await withDatabase(source,async()=>{
   const actor=source!.prepare("SELECT id,name,COALESCE(email,'') email,role,active FROM _users WHERE id=?").get(input.owner) as AuthUser&{active:number}|undefined;
   if(!actor?.active)throw Error('Actor unavailable');const application=applicationScopeFor(actor,input.appId);
   return withApplication(application,()=>{const access=accessFor(actor);if(!access.builder)throw Error('Builder unavailable');return runAuthorized(actor,access,()=>withAuditActor(actor,'publication-validation',()=>rehearseDraft(input.workspaceId,input.owner,input.planHash,{jobId:input.jobId,limit:1000000,deadline:Date.now()+15*60000,checkpoint:()=>{},cancelled:()=>!process.connected})));});
  });
  source.close();source=undefined;process.send?.({result},()=>process.exit(0));
 }catch{source?.close();process.exit(1);}
});
