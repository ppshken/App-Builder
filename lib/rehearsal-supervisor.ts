import {fork,type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {databasePath} from './db';
import {openRehearsalQueue,rehearsalQueuePath,sweepRehearsals,finishRehearsal,REHEARSAL_LEASE_MS,type RehearsalJob} from './rehearsal-jobs';
const root=globalThis as typeof globalThis&{__rehearsalSupervisor?:{timer:ReturnType<typeof setInterval>;child?:ChildProcess}};
export const rehearsalWorkerFile=()=>resolve('.rehearsal-worker','rehearsal-worker-entry.js');
export function startRehearsalSupervisor(){
 if(root.__rehearsalSupervisor)return;
 const state=root.__rehearsalSupervisor={timer:setInterval(tick,2000),child:undefined as ChildProcess|undefined};state.timer.unref();
 let assigned:{id:string;token:string}|undefined,startedAt=0;
 function tick(){
  if(!existsSync(rehearsalQueuePath(databasePath)))return;
  let q:ReturnType<typeof openRehearsalQueue>|undefined;
  try{q=openRehearsalQueue(rehearsalQueuePath(databasePath));
   if(state.child){if(assigned){const running=q.prepare("SELECT cancel_requested FROM jobs WHERE id=? AND token=? AND status='running'").get(assigned.id,assigned.token) as {cancel_requested:number}|undefined;if(!running||running.cancel_requested||Date.now()-startedAt>16*60000)state.child.kill();else q.prepare("UPDATE jobs SET lease_until=? WHERE id=? AND token=? AND status='running'").run(Date.now()+REHEARSAL_LEASE_MS,assigned.id,assigned.token);}return;}
   sweepRehearsals(q,databasePath);
   const pending=q.prepare("SELECT 1 FROM jobs WHERE status='queued' OR status='running' AND lease_until<? LIMIT 1").get(Date.now());if(!pending||!existsSync(rehearsalWorkerFile()))return;
   const options:import('node:child_process').ForkOptions&{windowsHide:true}={windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],execArgv:['--max-old-space-size=512'],env:{...process.env,NOCODE_DB_PATH:databasePath}};const child=state.child=fork(rehearsalWorkerFile(),[],options);
   assigned=undefined;startedAt=Date.now();child.on('message',message=>{const m=message as {id?:unknown;token?:unknown};if(typeof m.id==='string'&&typeof m.token==='string')assigned={id:m.id,token:m.token};});
   child.on('error',()=>{});child.on('exit',()=>{state.child=undefined;if(!assigned)return;let jobs:ReturnType<typeof openRehearsalQueue>|undefined;try{jobs=openRehearsalQueue(rehearsalQueuePath(databasePath));const job=jobs.prepare('SELECT * FROM jobs WHERE id=? AND token=?').get(assigned.id,assigned.token) as RehearsalJob|undefined;if(job){finishRehearsal(jobs,job);sweepRehearsals(jobs,databasePath);}}catch{/* Lease recovery handles a supervisor crash. */}finally{jobs?.close();}});
  }catch{/* Retry later; no row data or native errors are logged. */}finally{q?.close();}
 }
 tick();
}
