import type Database from 'better-sqlite3';
import {randomBytes} from 'node:crypto';
import {applicationIds} from './application-schema';
import {applicationTable} from './application-context';
import {AuthError} from './auth';
export function securitySeparated(database:Database.Database){return !!database.prepare("SELECT 1 FROM sqlite_master WHERE name='_builder_security' AND type='table'").get()&&!!database.prepare('SELECT 1 FROM _builder_security WHERE id=1 AND separated=1').get();}
export function applicationBuilder(database:Database.Database,appId:string,userId:number){return !!database.prepare('SELECT 1 FROM _application_builders WHERE app_id=? AND user_id=?').get(appId,userId);}
// Called only from an owner-authorized POST, never from a GET or render. One transaction
// snapshots existing runtime rights before switching away from global-role fallback.
export function separateBuilderSecurity(database:Database.Database){return database.transaction(()=>{
 if(securitySeparated(database))return {ok:true,already_separated:true};
 const ids=applicationIds(database),users=database.prepare("SELECT id,role FROM _users WHERE role<>'owner'").all() as {id:number;role:string}[];
 for(const id of ids){
  const config=(table:string)=>'"'+applicationTable(id,table)+'"';
  const connected=new Set((database.prepare('SELECT DISTINCT t.name FROM _tables t LEFT JOIN _application_datasets d ON d.table_name=t.name AND d.app_id=? WHERE t.owner_app_id=? OR d.can_read=1').all(id,id) as {name:string}[]).map(t=>t.name));
  for(const role of database.prepare("SELECT name,label,builder FROM _roles WHERE name<>'owner'").all() as {name:string;label:string;builder:number}[]){
   const legacy=id==='default'?{can_use:1,builder:1}:database.prepare('SELECT can_use,builder FROM _application_roles WHERE app_id=? AND role_name=?').get(id,role.name) as {can_use:number;builder:number}|undefined;
   if(!legacy?.can_use)continue;
   const inherited=users.filter(user=>user.role===role.name&&!database.prepare('SELECT 1 FROM _application_members WHERE app_id=? AND user_id=?').get(id,user.id));
   if(!inherited.length)continue;
   // Keep formula role keys unchanged. A conflicting local key aborts rather than
   // overwriting an existing role or changing USERROLEKEY() implicitly.
   if(database.prepare('SELECT 1 FROM _application_local_roles WHERE app_id=? AND name=?').get(id,role.name))throw new AuthError('รหัสบทบาทเดิมชนกับบทบาทรายแอป กรุณาเปลี่ยนบทบาทที่ชนก่อนย้ายสิทธิ์');
   const label=role.label;if(database.prepare('SELECT 1 FROM _application_local_roles WHERE app_id=? AND label=? COLLATE NOCASE').get(id,label))throw new AuthError('ชื่อบทบาทเดิมซ้ำกับบทบาทรายแอป กรุณาเปลี่ยนชื่อบทบาทรายแอปที่ซ้ำก่อนย้าย เพื่อรักษาค่า USERROLE() เดิม');
   database.prepare('INSERT INTO _application_local_roles(app_id,name,label) VALUES(?,?,?)').run(id,role.name,label);
   const builder=!!role.builder&&!!legacy.builder;
   if(builder){
    // Dataset ceilings still apply at runtime. Only currently connected datasets
    // are copied so removing Builder later does not grant unrelated app tables.
    for(const table of connected)database.prepare('INSERT INTO _application_role_tables VALUES(?,?,?,?,?,?,?,?)').run(id,role.name,table,1,1,1,1,1);
    database.prepare('INSERT INTO _application_role_actions(app_id,role_name,action_name) SELECT ?,?,name FROM '+config('_actions')).run(id,role.name);
   }else{
    for(const g of database.prepare('SELECT * FROM _role_tables WHERE role_name=?').all(role.name) as any[])if(connected.has(g.table_name))database.prepare('INSERT INTO _application_role_tables VALUES(?,?,?,?,?,?,?,?)').run(id,role.name,g.table_name,g.can_read,g.can_create,g.can_update,g.can_delete,g.can_export);
    for(const g of database.prepare('SELECT * FROM _role_row_rules WHERE role_name=?').all(role.name) as any[])if(connected.has(g.table_name))database.prepare('INSERT INTO _application_role_rows VALUES(?,?,?,?,?)').run(id,role.name,g.table_name,g.operation,g.expression);
    for(const g of database.prepare('SELECT g.action_name,a.table_name FROM '+config('_role_actions')+' g JOIN '+config('_actions')+' a ON a.name=g.action_name WHERE g.role_name=?').all(role.name) as {action_name:string;table_name:string}[])if(connected.has(g.table_name))database.prepare('INSERT INTO _application_role_actions VALUES(?,?,?)').run(id,role.name,g.action_name);
   }
   for(const user of inherited){database.prepare('INSERT INTO _application_members(app_id,user_id,role_name,can_use) VALUES(?,?,?,1)').run(id,user.id,role.name);if(builder)database.prepare('INSERT INTO _application_builders(app_id,user_id) VALUES(?,?)').run(id,user.id);}
  }
 }
 ensureBuilderAccountRole(database);
 database.prepare('INSERT INTO _builder_security(id,separated) VALUES(1,1)').run();
 return {ok:true};
 }).immediate();}
export function builderSecurityOverview(database:Database.Database){return {separated:securitySeparated(database),apps:database.prepare('SELECT id,label FROM _applications ORDER BY created_at,id').all(),builders:database.prepare('SELECT app_id,user_id FROM _application_builders ORDER BY app_id,user_id').all(),basic_role:(database.prepare("SELECT name FROM _roles WHERE name LIKE 'builder_user%' AND builder=0 ORDER BY rowid DESC LIMIT 1").get() as {name:string}|undefined)?.name};}

export function ensureBuilderAccountRole(database:Database.Database){const existing=builderSecurityOverview(database).basic_role;if(existing)return existing;
 let basic='builder_user';while(database.prepare('SELECT 1 FROM _roles WHERE name=?').get(basic))basic='builder_user_'+randomBytes(4).toString('hex');
 let label='ผู้ใช้งานระบบ';while(database.prepare('SELECT 1 FROM _roles WHERE label=?').get(label))label='ผู้ใช้งานระบบ '+randomBytes(3).toString('hex');
 database.prepare('INSERT INTO _roles(name,label,builder) VALUES(?,?,0)').run(basic,label);
 return basic;
}
