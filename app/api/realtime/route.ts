import {createHash} from 'node:crypto';
import {currentApplication,withApplication} from '@/lib/application-context';
import {applicationScopeFor} from '@/lib/applications';
import {withAuth} from '@/lib/auth-api';
import {requestUser} from '@/lib/auth';
import {accessFor} from '@/lib/permissions';
import {tableAccess} from '@/lib/access';
import {db,isIsolatedDatabase,databaseGeneration} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
export const GET=withAuth(async(req:Request)=>{
 // Draft request databases close when the response is returned; never retain them in a stream.
 if(isIsolatedDatabase())return new Response(null,{status:204});
 let stop=()=>{};
 const stream=new ReadableStream<Uint8Array>({start(controller){
  const encoder=new TextEncoder();let closed=false,last='',ticks=0,timer:ReturnType<typeof setInterval>|undefined,expiry:ReturnType<typeof setTimeout>|undefined;
  stop=()=>{if(closed)return;closed=true;clearInterval(timer);clearTimeout(expiry);req.signal.removeEventListener('abort',stop);try{controller.close();}catch{}};
  const send=(event:string,data:unknown)=>{if(!closed)controller.enqueue(encoder.encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n'));};
  const tick=()=>{if(closed)return;try{const user=requestUser(req);if(!user){send('unauthorized',{});stop();return;}let application;try{application=applicationScopeFor(user,currentApplication()?.id||'default');}catch{send('application-denied',{});stop();return;}const {access,tables}=withApplication(application,()=>{const access=accessFor(user),tables=Object.fromEntries((db.prepare('SELECT t.name,COALESCE(v.revision,0) AS revision FROM _tables t LEFT JOIN _realtime_versions v ON v.table_name=t.name WHERE t.realtime_enabled=1 ORDER BY t.name').all() as {name:string;revision:number}[]).filter(t=>tableAccess(access,t.name).read).map(t=>[t.name,databaseGeneration()+':'+t.revision]));return {access,tables};});const access_revision=createHash('sha256').update(JSON.stringify(access)).digest('hex'),serialized=JSON.stringify({tables,access_revision});if(serialized!==last){last=serialized;send('snapshot',{tables,access_revision});}else if(++ticks%15===0)controller.enqueue(encoder.encode(': heartbeat\n\n'));}catch{stop();}};
  req.signal.addEventListener('abort',stop,{once:true});if(req.signal.aborted){stop();return;}tick();if(!closed){timer=setInterval(tick,1000);expiry=setTimeout(stop,60000);}
 },cancel(){stop();}});
 return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private, no-store, no-transform','X-Accel-Buffering':'no','Connection':'keep-alive'}});
});
