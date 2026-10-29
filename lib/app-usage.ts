import type Database from 'better-sqlite3';
import type {AuthUser} from './auth';
import {auditDate} from './audit-log';
const lastPrune=new WeakMap<Database.Database,number>();
export function recordAppUsage(db:Database.Database,actor:Pick<AuthUser,'id'|'name'>,appId:string|null,event:string,target:string,status=200){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_app_usage'").get())return;
 const now=Date.now(),days=Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180));if((lastPrune.get(db)||0)<now-3600000){db.prepare('DELETE FROM _app_usage WHERE id IN (SELECT id FROM _app_usage WHERE occurred_at<? ORDER BY occurred_at LIMIT 5000)').run(now-days*86400000);lastPrune.set(db,now);}
 db.prepare('INSERT INTO _app_usage(app_id,actor_id,actor_name,event,target,status,occurred_at) VALUES(?,?,?,?,?,?,?)').run(appId,actor.id,actor.name,event,target.slice(0,240),status,Date.now());
}
export function readAppUsage(db:Database.Database,params:URLSearchParams){
 const clauses:string[]=[],values:(string|number)[]=[];
 for(const [param,column] of [['app','app_id'],['user','actor_id'],['event','event']] as const){const v=params.get(param);if(v){clauses.push(column+'=?');values.push(v);}}
 for(const [param,op] of [['from','>='],['to','<']] as const){const v=params.get(param);if(!v)continue;const stamp=auditDate(v);clauses.push('occurred_at'+op+'?');values.push(stamp+(param==='to'?86400000:0));}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'',total=(db.prepare('SELECT COUNT(*) n FROM _app_usage'+where).get(...values) as {n:number}).n;
 const page=Math.min(Math.max(1,Math.floor(Number(params.get('page'))||1)),Math.max(1,Math.ceil(total/30)));
 return {actors:db.prepare('SELECT actor_id id,MAX(actor_name) name FROM _app_usage GROUP BY actor_id ORDER BY name LIMIT 1000').all(),retention_days:Math.max(1,Math.min(3650,Number(process.env.NOCODE_USAGE_RETENTION_DAYS)||180)),rows:db.prepare('SELECT * FROM _app_usage'+where+' ORDER BY occurred_at DESC,id DESC LIMIT 30 OFFSET ?').all(...values,(page-1)*30),total,page,pages:Math.max(1,Math.ceil(total/30))};
}
