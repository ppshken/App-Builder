import type Database from 'better-sqlite3';
import {applicationTable} from './application-context';
import {actionPermission} from './action-config';
import type {TableAccess} from './access';
export function automaticRoleGrants(database:Database.Database,id:string,datasets:Record<string,TableAccess>){
 const tables=Object.fromEntries(Object.entries(datasets).filter(([,r])=>r.read).map(([name,r])=>[name,{...r}]));
 const actions=(database.prepare('SELECT name,table_name,kind FROM "'+applicationTable(id,'_actions')+'"').all() as {name:string;table_name:string;kind:string}[]).filter(a=>tables[a.table_name]?.read&&tables[a.table_name]?.[actionPermission(a.kind)]).map(a=>a.name);
 return {tables,actions};
}
