import {createHash,randomUUID} from 'node:crypto';
import {setImmediate as yieldRow} from 'node:timers/promises';
import {db,columnsOf,databaseGeneration} from './db';
import {AuthError,type AuthUser} from './auth';
import {currentApplication,withApplication} from './application-context';
import {applicationScopeFor} from './applications';
import {accessFor,currentUser,runAuthorized,assertTablePermission} from './permissions';
import {actions,executeAction,matches,sliceFor} from './automation';
import {calculateRow,assertIdentifier} from './columns';
import {expressionContext} from './expression-context';
import {rowAllowed} from './row-access';
import {assertRowVersion} from './row-version';
import {validateBulkConfig} from './bulk-action-config';
import {auditContext} from './audit-context';
import {viewIsVisible} from './view-visibility';

export type BulkRequest={actionId:string;viewName:string;rowIds:number[];versions:Record<string,string>;idempotencyKey:string;dataEpoch:string};
export type BulkResult={rowId:number;status:'success'|'failed'|'skipped';code?:string};
type Ledger={total:number;request_hash:string;definition_hash:string;results_json:string;status:string;lease_token:string;lease_until:number};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function deny(message:string,status=400):never{throw new AuthError(message,status);}
export function bulkDataEpoch(){return (db.prepare('SELECT epoch FROM _bulk_action_state WHERE id=1').get() as {epoch:string}).epoch;}
export function parseBulkRequest(value:unknown):BulkRequest{
 const b=value as BulkRequest;
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['actionId','viewName','rowIds','versions','idempotencyKey','dataEpoch'].includes(k)))deny('Invalid bulk request');
 if(typeof b.dataEpoch!=='string'||!/^[a-f0-9]{32}$/.test(b.dataEpoch))deny('Data epoch required');
 assertIdentifier(b.actionId);assertIdentifier(b.viewName);
 if(typeof b.idempotencyKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(b.idempotencyKey))deny('Invalid idempotency key');
 if(!Array.isArray(b.rowIds)||!b.rowIds.length||b.rowIds.length>100||b.rowIds.some(id=>!Number.isSafeInteger(id)||id<1))deny('Select 1–100 row IDs');
 const ids=[...new Set(b.rowIds)];
 if(!b.versions||typeof b.versions!=='object'||Array.isArray(b.versions)||Object.keys(b.versions).length!==ids.length||ids.some(id=>typeof b.versions[id]!=='string'||!/^[a-f0-9]{64}$/.test(b.versions[id])))deny('Row versions are required');
 return {actionId:b.actionId,viewName:b.viewName,dataEpoch:b.dataEpoch,rowIds:ids,versions:Object.fromEntries(ids.map(id=>[id,b.versions[id]])),idempotencyKey:b.idempotencyKey};
}
// Conservative fail-closed boundary: never suppress normal write hooks to make a batch eligible.
export function bulkEligible(table:string){
 assertIdentifier(table);assertTablePermission(table,'read');assertTablePermission(table,'update');
 const hooks=db.prepare("SELECT name,config_json FROM _automations WHERE table_name=? AND enabled=1 AND event='update' ORDER BY name").all(table) as {name:string;config_json:string}[];
 const available=actions(table),cols=columnsOf(table);
 // Only synchronous, same-row, direct update hooks are demonstrably safe. Keep the normal hook runner unchanged.
 return hooks.map(hook=>{const w=JSON.parse(hook.config_json);if(w.execution!=='save'||!Array.isArray(w.steps)||!w.steps.length)deny('Bulk requires update-only synchronous hooks',409);
  const linked=w.steps.map((step:any)=>{const action=available.find(a=>a.name===step.action_name);if(step.kind!=='action'||step.parent_ref||!action||action.kind!=='set'||action.config?.actions?.length||Object.keys(action.values).some(n=>cols.find(c=>c.name===n)?.is_key))deny('Bulk hook has unsupported side effects',409);return action;});
  return {hook,linked};
 });
}
function resolve(request:Pick<BulkRequest,'actionId'|'viewName'>){
 const view=db.prepare('SELECT * FROM _views WHERE name=?').get(request.viewName) as any;
 if(!view||view.kind!=='table')deny('Bulk Table View unavailable',403);
 const config=validateBulkConfig(JSON.parse(view.display_json||'{}').bulk_actions);
 if(!config.enabled||!config.allowed_action_ids.includes(request.actionId))deny('Action is not enabled for this View',403);
 const action=actions(view.table_name).find(a=>a.name===request.actionId);
 if(!action||action.kind!=='set'||action.config?.actions?.length)deny('Only existing row update Actions are supported',403);
 const hooks=bulkEligible(view.table_name);
 const cols=columnsOf(view.table_name);
 if(cols.some(c=>c.is_key&&c.reset_on_edit))deny('Bulk automatic key resets are not supported',409);
 if(Object.keys(action.values).some(name=>cols.find(c=>c.name===name)?.is_key))deny('Bulk key changes are not supported',409);
 if(!viewIsVisible(view.show_if,{...expressionContext(),userEmail:currentUser()?.email||''}))deny('View unavailable',403);
 return {view,config,action,cols,signature:hash([view,action,cols,hooks])};
}
function identity(){const user=currentUser();if(!user)deny('Authentication required',401);return {user,app:currentApplication()?.id||'default'};}
export function bulkSummary(results:BulkResult[],total:number,status='completed'){
 return {status,total,success:results.filter(r=>r.status==='success').length,failed:results.filter(r=>r.status==='failed').length,skipped:results.filter(r=>r.status==='skipped').length,processed:results.length,results};
}
export function bulkStatus(key:string){const {user,app}=identity();const r=db.prepare('SELECT * FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(app,user.id,key) as Ledger|undefined;if(!r)deny('Operation not found',404);return {...bulkSummary(JSON.parse(r.results_json),r.total,r.status)};}
export function bulkOptions(viewName:string,rowIds?:number[]){
 const view=db.prepare('SELECT table_name,display_json FROM _views WHERE name=? AND kind=?').get(viewName,'table') as any;if(!view)return [];
 const config=JSON.parse(view.display_json||'{}').bulk_actions;if(!config?.enabled)return [];
 if(rowIds&&(rowIds.length>100||rowIds.some(id=>!Number.isSafeInteger(id)||id<1)))deny('Invalid selected row IDs');
 return (config.allowed_action_ids as string[]).flatMap(actionId=>{try{const r=resolve({viewName,actionId});
  if(rowIds?.length&&!rowIds.some(id=>{const raw=db.prepare('SELECT * FROM "t_'+r.view.table_name+'" WHERE id=?').get(id) as Record<string,any>|undefined;if(!raw||!rowAllowed(r.view.table_name,raw,'read')||!rowAllowed(r.view.table_name,raw,'update'))return false;const email=currentUser()?.email||'',now=new Date(),context=expressionContext(now,email),row=calculateRow(r.cols,raw,false,now,false,email,context).row,slice=sliceFor(r.view.slice_name,r.view.table_name);return matches(r.action.condition_expr,row,email,r.view.table_name,context)&&(!slice||matches(slice.filter_expr,row,email,r.view.table_name,context));}))return [];
  return [{name:actionId,label:r.action.label,fields:Object.keys(r.action.values).map(n=>r.cols.find(c=>c.name===n)?.label||n)}];}catch{return [];}});
}
export async function executeBulk(input:unknown){
 const request=parseBulkRequest(input),{user,app}=identity();
 if(request.dataEpoch!==bulkDataEpoch())throw Object.assign(new AuthError('Data restored; reload and select rows again',409),{code:'DATA_EPOCH_CHANGED'});
 const receipt=db.prepare('SELECT * FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(app,user.id,request.idempotencyKey) as Ledger|undefined;
 if(receipt){if(receipt.request_hash!==hash(request))deny('Idempotency key belongs to another request',409);if(receipt.status==='completed'||receipt.lease_until>Date.now())return bulkSummary(JSON.parse(receipt.results_json),receipt.total,receipt.status);}
 const initial=resolve(request);
 if(request.rowIds.length>initial.config.max_selection)deny('Batch selection exceeds View limit');
 const requestHash=hash(request),token=randomUUID(),generation=databaseGeneration(),started=Date.now(),key=[app,user.id,request.idempotencyKey] as const;
 const claim=db.transaction(()=>{
  const previous=db.prepare('SELECT * FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(...key) as Ledger|undefined;
  if(previous){if(previous.request_hash!==requestHash)deny('Idempotency key belongs to another request',409);if(previous.status==='completed'||previous.lease_until>started)return previous;}
  if(db.prepare("SELECT 1 FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND status='running' AND lease_until>? AND request_key<>?").get(app,user.id,started,request.idempotencyKey))deny('Another bulk operation is running',429);
  if((db.prepare("SELECT count(*) n FROM _bulk_action_runs WHERE status='running' AND lease_until>?").get(started) as {n:number}).n>=4)deny('Bulk capacity reached; retry later',429);
  if(!previous&&(db.prepare('SELECT count(*) AS n FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND created_at>?').get(app,user.id,started-60000) as {n:number}).n>=10)deny('Bulk rate limit exceeded',429);
  if(previous)db.prepare('UPDATE _bulk_action_runs SET lease_token=?,lease_until=?,updated_at=? WHERE app_id=? AND actor_id=? AND request_key=?').run(token,started+60000,started,...key);
  else db.prepare('INSERT INTO _bulk_action_runs(app_id,actor_id,request_key,total,request_hash,definition_hash,status,lease_token,lease_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...key,request.rowIds.length,requestHash,initial.signature,'running',token,started+60000,started,started);
  return null;
 }).immediate();
 if(claim)return bulkSummary(JSON.parse(claim.results_json),request.rowIds.length,claim.status);
 for(const rowId of request.rowIds){
  if(generation!==databaseGeneration())deny('Database changed; reload before continuing',409);
  const run=db.prepare('SELECT * FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(...key) as Ledger;
  if(!run||run.lease_token!==token)deny('Operation ownership changed',409);
  if((JSON.parse(run.results_json) as BulkResult[]).some(r=>r.rowId===rowId))continue;
  const store=(result:BulkResult)=>db.transaction(()=>{const current=db.prepare('SELECT * FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(...key) as Ledger;if(!current||current.lease_token!==token)deny('Operation ownership changed',409);const results:BulkResult[]=JSON.parse(current.results_json);if(results.some(r=>r.rowId===rowId))return;results.push(result);db.prepare('UPDATE _bulk_action_runs SET results_json=?,lease_until=?,updated_at=? WHERE app_id=? AND actor_id=? AND request_key=?').run(JSON.stringify(results),Date.now()+60000,Date.now(),...key);
   const audit=auditContext();db.prepare('INSERT INTO _audit_log(event_id,request_id,occurred_at,actor_id,actor_name,actor_email,actor_role,category,entity_type,entity_key,entity_label,operation,source,changes_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),audit?.requestId||request.idempotencyKey,Date.now(),user.id,user.name,user.email,user.role,'actions','bulk_action',JSON.stringify([app,initial.view.table_name,rowId]),initial.view.table_name+' #'+rowId,'update',audit?.source||'bulk',JSON.stringify([{path:['bulk_action'],before:null,after:{action:request.actionId,...result}}]));
  })();
  try{
   db.transaction(()=>{
    if(Date.now()-started>15000){store({rowId,status:'failed',code:'EXECUTION_TIMEOUT'});return;}
    const actor=db.prepare("SELECT id,name,COALESCE(email,'') AS email,role,active FROM _users WHERE id=?").get(user.id) as AuthUser&{active:number}|undefined;
    if(!actor?.active)throw new AuthError('Permission denied',403);
    const scope=applicationScopeFor(actor,app);
    withApplication(scope,()=>runAuthorized(actor,accessFor(actor),()=>{
     const current=resolve(request);if(current.signature!==run.definition_hash){store({rowId,status:'skipped',code:'ACTION_CHANGED'});return;}
     const raw=db.prepare('SELECT * FROM "t_'+current.view.table_name+'" WHERE id=?').get(rowId) as Record<string,any>|undefined;
     if(!raw||!rowAllowed(current.view.table_name,raw,'read')){store({rowId,status:'failed',code:'ROW_NOT_FOUND'});return;}
     if(!rowAllowed(current.view.table_name,raw,'update'))throw new AuthError('Permission denied',403);
     assertRowVersion(current.view.table_name,current.cols,raw,request.versions[rowId]);
     const now=new Date(),context=expressionContext(now,actor.email),row=calculateRow(current.cols,raw,false,now,false,actor.email,context).row,slice=sliceFor(current.view.slice_name,current.view.table_name);
     if(!matches(current.action.condition_expr,row,actor.email,current.view.table_name,context)||slice&&!matches(slice.filter_expr,row,actor.email,current.view.table_name,context)){store({rowId,status:'skipped',code:'ACTION_NOT_AVAILABLE'});return;}
     executeAction(request.actionId,rowId,actor.email,current.view.slice_name);
     store({rowId,status:'success'});
    }));
   }).immediate();
  }catch(e){
   const error=e as {status?:number;code?:string};const code=error.status===403||error.status===401?'PERMISSION_DENIED':error.status===409?'VERSION_CONFLICT':error.code?.startsWith('SQLITE_')?'DATABASE_ERROR':'VALIDATION_ERROR';
   // No row data, formula values, SQL text or stack traces in client errors/logs.
   console.warn('Bulk row failure',{operation:hash(request.idempotencyKey).slice(0,16),code,...(error.code?.match(/^SQLITE_[A-Z_]{1,60}$/)?{databaseCode:error.code}:{})});
   store({rowId,status:'failed',code});
  }
  await yieldRow();
 }
 db.prepare("UPDATE _bulk_action_runs SET status='completed',lease_until=0,updated_at=? WHERE app_id=? AND actor_id=? AND request_key=? AND lease_token=?").run(Date.now(),...key,token);
 const completed=db.prepare('SELECT results_json FROM _bulk_action_runs WHERE app_id=? AND actor_id=? AND request_key=?').get(...key) as Ledger;
 return bulkSummary(JSON.parse(completed.results_json),request.rowIds.length);
}
