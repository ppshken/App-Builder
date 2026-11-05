import {db,platformDatabase,columnsOf} from './db';
import {currentApplication,withApplication} from './application-context';
import {applicationScopeFor} from './applications';
import {runAuthorized,accessFor,currentUser,assertTablePermission} from './permissions';
import {rowAllowed} from './row-access';
import {calculateRow,refTablesOf} from './columns';
import {expressionContext} from './expression-context';
import {evaluateExpression} from './expression';
import {viewIsVisible} from './view-visibility';
import {deliverPush,pushRecipientIds,type PushMessage} from './push-notifications';
import type {WorkflowStep} from './workflow-config';
import type {AuthUser} from './auth';
export async function runPushStep(step:Extract<WorkflowStep,{kind:'push'}>,job:{id:string;next_step:number;table_name:string;row_id:number;event:string},raw:Record<string,any>,check:()=>void){
 const app=currentApplication()?.id||'default',email=currentUser()!.email,now=new Date(),context=expressionContext(now,email),cols=columnsOf(job.table_name),row=calculateRow(cols,raw,false,now,false,email,context).row,recipients=pushRecipientIds(evaluateExpression(step.recipients_expr,row,{...context,now,userEmail:email,refTables:refTablesOf(cols)}));
 const prepare=(id:number):PushMessage|null=>{const user=platformDatabase().prepare('SELECT id,name,email,role,active FROM _users WHERE id=?').get(id) as AuthUser&{active:number}|undefined;if(!user?.active)return null;let scope:ReturnType<typeof applicationScopeFor>;try{scope=applicationScopeFor(user,app);}catch{return null;}
 return withApplication(scope,()=>runAuthorized(user,accessFor(user),()=>{const latest=job.event==='delete'?raw:db.prepare('SELECT * FROM "t_'+job.table_name+'" WHERE id=?').get(job.row_id) as Record<string,any>|undefined;try{assertTablePermission(job.table_name,'read');if(!latest||!rowAllowed(job.table_name,latest))return null;}catch{return null;}const date=new Date(),ctx=expressionContext(date,user.email||''),columns=columnsOf(job.table_name),values=calculateRow(columns,latest!,false,date,false,user.email||'',ctx).row,options={...ctx,now:date,userEmail:user.email||'',refTables:refTablesOf(columns)};const text=(expr:string)=>{const value=evaluateExpression(expr,values,options);if(value===null)return '';if(!['string','number','boolean'].includes(typeof value))throw Error('สูตรข้อความ Push ต้องเป็นค่าเดียว');return String(value);};let url='/app/'+app+'/';if(step.view_name){const v=db.prepare('SELECT name,show_if FROM _views WHERE name=?').get(step.view_name) as {name:string;show_if:string}|undefined;if(v&&viewIsVisible(v.show_if,options))url+='?view='+encodeURIComponent(v.name)+(job.event!=='delete'?'&row='+job.row_id:'');}return {title:text(step.title_expr),body:text(step.body_expr),url,tag:job.id+':'+job.next_step};}));};
 return deliverPush(platformDatabase(),{app,jobId:job.id,step:job.next_step,recipients},prepare,check);
}
