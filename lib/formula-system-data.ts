import type Database from 'better-sqlite3';
import {currentApplication} from './application-context';
import {currentUser} from './permissions';
import {AuthError} from './auth';
import {canUseApplication} from './applications';
import {securitySeparated} from './builder-security';
import {FORMULA_SYSTEM_TABLES} from './formula-system-schema';
import type {ExpressionTable,Value} from './expression';

// Only a public directory projection: no credentials, sessions or private profiles.
export function formulaSystemData(database:Database.Database):Record<string,ExpressionTable>{
 const actor=currentUser(),app=currentApplication()?.id||'default';
 if(!actor||!canUseApplication(actor,app,database))throw new AuthError('ไม่มีสิทธิ์อ่านข้อมูลผู้ใช้ของแอปนี้',403);
 const separated=securitySeparated(database)?1:0;
 const users=database.prepare(`SELECT u.id,u.name,COALESCE(u.nickname,'') nickname,
 CASE WHEN u.role<>'owner' AND m.can_use=1 AND r.name IS NOT NULL THEN r.name ELSE u.role END role_id,
 CASE WHEN u.role<>'owner' AND m.can_use=1 AND r.name IS NOT NULL THEN r.label ELSE g.label END role_name
 FROM _users u JOIN _roles g ON g.name=u.role
 LEFT JOIN _application_members m ON m.user_id=u.id AND m.app_id=?
 LEFT JOIN _application_local_roles r ON r.app_id=m.app_id AND r.name=m.role_name
 LEFT JOIN _application_builders b ON b.user_id=u.id AND b.app_id=?
 LEFT JOIN _application_roles grant_role ON grant_role.app_id=? AND grant_role.role_name=u.role
 WHERE u.active=1 AND (u.role='owner' OR (?=1 AND b.user_id IS NOT NULL)
 OR (m.can_use=1 AND r.name IS NOT NULL)
 OR (m.user_id IS NULL AND ?=0 AND (?='default' OR grant_role.can_use=1)))
 ORDER BY u.id LIMIT 10001`).all(app,app,app,separated,separated,app) as {id:number;name:string;nickname:string;role_id:string;role_name:string}[];
 const roles=database.prepare('SELECT name id,label name FROM _application_local_roles WHERE app_id=? ORDER BY name LIMIT 10001').all(app) as {id:string;name:string}[];
 const roleMap=new Map(roles.map(role=>[role.id,{...role,app_id:app}]));for(const user of users)if(!roleMap.has(user.role_id))roleMap.set(user.role_id,{id:user.role_id,name:user.role_name,app_id:app});
 if(users.length>10000||roleMap.size>10000)throw Error('ข้อมูลผู้ใช้หรือบทบาทของแอปเกิน 10,000 รายการสำหรับสูตร');
 const records:Record<string,Record<string,Value>[]>={_app_users:users.map(user=>({...user,app_id:app})),_app_user_roles:[...roleMap.values()]};
 return Object.fromEntries(FORMULA_SYSTEM_TABLES.map(table=>[table.name,{columns:table.columns.map(c=>c.name),key:'id',rows:records[table.name],labels:Object.fromEntries(records[table.name].map(row=>[String(row.id),String(row.name)])),refs:{},relatedRefs:{}}]));
}
