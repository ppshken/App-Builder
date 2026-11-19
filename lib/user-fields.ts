import {platformDatabase} from './db';
import {canUseApplication} from './applications';
import {currentApplication} from './application-context';
import type {AuthUser} from './auth';
import type Database from 'better-sqlite3';
export function userFieldOptions(database:Database.Database=platformDatabase()){
 const app=currentApplication()?.id||'default';
 const users=(database.prepare("SELECT id,name,role,username,nickname FROM _users WHERE active=1 ORDER BY name,id").all() as AuthUser[]).filter(user=>canUseApplication(user,app,database));
 const avatars=new Map((users.length?database.prepare('SELECT user_id,avatar FROM _user_profiles WHERE user_id IN (SELECT value FROM json_each(?))').all(JSON.stringify(users.map(u=>u.id))):[] as {user_id:number;avatar:string}[]).map((p:any)=>[p.user_id,p.avatar] as [number,string]));
 return users.map(user=>({id:user.id,name:user.name,nickname:user.nickname||'',username:user.username||'',avatar:avatars.get(user.id)||''}));
}
type UserFieldColumn={name:string;type:string;is_virtual?:unknown};
// One read-only validator per operation; never cache memberships across requests.
export function createUserFieldValidator(database?:Database.Database){
 let ids:Set<number>|undefined;
 return (cols:UserFieldColumn[],row:Record<string,unknown>,before:Record<string,unknown>={})=>{const changed=cols.filter(c=>!c.is_virtual&&c.type==='user'&&row[c.name]!=null&&row[c.name]!==''&&String(row[c.name])!==String(before[c.name]));if(!changed.length)return;ids??=new Set(userFieldOptions(database).map(u=>u.id));for(const c of changed)if(!ids.has(Number(row[c.name])))throw Error('ต้องเลือกผู้ใช้งานที่เปิดใช้งานและมีสิทธิ์เข้าแอปนี้');};
}
export function assertUserFields(cols:UserFieldColumn[],row:Record<string,unknown>,before:Record<string,unknown>={}){createUserFieldValidator()(cols,row,before);}
// A resolver is created inside one report, never shared across app/actor/database scopes.
export function createUserFieldLabelResolver(){
 let users:Map<number,ReturnType<typeof userFieldOptions>[number]>|undefined;
 return (value:unknown)=>{if(value==null||value==='')return '';users??=new Map(userFieldOptions().map(u=>[u.id,u]));const user=users.get(Number(value));return user?(user.nickname||user.name):'ผู้ใช้ไม่พร้อมใช้งาน (#'+String(value)+')';};
}
export function userFieldLabel(value:unknown){return createUserFieldLabelResolver()(value);}
