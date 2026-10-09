import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
export type AuditActor={id:number;name:string;email:string;role:string};
type AuditContext={actor:AuditActor;requestId:string;source:string;enabled:boolean};
const globalAudit=globalThis as typeof globalThis & {__nocodeAuditContext?:AsyncLocalStorage<AuditContext>};
const scope=globalAudit.__nocodeAuditContext??=new AsyncLocalStorage<AuditContext>();
export function auditContext(){return scope.getStore();}
export function withAuditActor<T>(actor:AuditActor,source:string,work:()=>T){return scope.run({actor,source,requestId:randomUUID(),enabled:true},work);}
export function withoutAudit<T>(work:()=>T){const old=scope.getStore();return old?scope.run({...old,enabled:false},work):work();}
