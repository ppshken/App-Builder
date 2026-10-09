import {actionPermission} from "./action-config";
import {rowAllowed,assertRowAllowed} from "./row-access";
import {AsyncLocalStorage} from "node:async_hooks";
import type Database from "better-sqlite3";
import {db,columnsOf} from "./db";
import {AuthError,type AuthUser} from "./auth";
import {NO_ACCESS,tableAccess,type AppAccess,type TableAccess} from "./access";
const scope=new AsyncLocalStorage<{user:AuthUser;access:AppAccess}>();
export function accessFor(user:AuthUser|null,database:Database.Database=db):AppAccess{
 if(!user)return NO_ACCESS;if(user.role==="owner")return {owner:true,builder:true,tables:{},actions:[]};
 const role=database.prepare("SELECT builder FROM _roles WHERE name=?").get(user.role) as {builder:number}|undefined;if(!role)return NO_ACCESS;
 const tables:AppAccess['tables']={};for(const g of database.prepare("SELECT * FROM _role_tables WHERE role_name=?").all(user.role) as any[])tables[g.table_name]={read:!!g.can_read,create:!!g.can_create,update:!!g.can_update,delete:!!g.can_delete};
 return {owner:false,builder:!!role.builder,tables,actions:(database.prepare("SELECT action_name FROM _role_actions WHERE role_name=?").all(user.role) as {action_name:string}[]).map(g=>g.action_name)};
}
export function runAuthorized<T>(user:AuthUser,access:AppAccess,work:()=>T){return scope.run({user,access},work);}
export function currentScopeKey(){return scope.getStore();}
export function currentUser(){return scope.getStore()?.user;}
export function currentAccess(){return scope.getStore()?.access || {owner:true,builder:true,tables:{},actions:[]};}
export function canRead(table:string){return tableAccess(currentAccess(),table).read;}
export function assertTablePermission(table:string,operation:keyof TableAccess){if(!tableAccess(currentAccess(),table)[operation])throw new AuthError("ไม่มีสิทธิ์"+({read:"ดู",create:"เพิ่ม",update:"แก้ไข",delete:"ลบ"}[operation])+"ข้อมูลของตารางนี้",403);}
export function canExecuteAction(action:{name:string;table_name:string;kind:string}){const a=currentAccess();return tableAccess(a,action.table_name).read && tableAccess(a,action.table_name)[actionPermission(action.kind)] && (a.owner||a.builder||a.actions.includes(action.name));}
export function assertImageAccess(id:string){
 const access=currentAccess();if(access.owner||access.builder)return;
 let referenced=false;for(const {name} of db.prepare("SELECT name FROM _tables").all() as {name:string}[])for(const c of columnsOf(name).filter(c=>["image","signature"].includes(c.type)&&!c.is_virtual)){
  const rows=db.prepare('SELECT * FROM "t_'+name+'" WHERE "'+c.name+'"=?').all('/api/images/'+id) as any[];if(rows.length){referenced=true;if(canRead(name)&&rows.some(row=>rowAllowed(name,row)))return;}
 }
 if(!referenced && Object.values(access.tables).some(t=>t.read&&(t.create||t.update)) && db.prepare("SELECT 1 FROM _image_uploads WHERE image_id=? AND user_id=?").get(id,currentUser()?.id))return;
 throw new AuthError("ไม่มีสิทธิ์ดูรูปภาพนี้",403);
}

import type {Column} from "./columns";
export function assertReferenceWrites(cols:Column[],row:Record<string,unknown>,before:Record<string,unknown>={}){for(const c of cols.filter(c=>!c.is_virtual&&c.ref_table&&(c.type==="ref"||c.type==="list"))){const normalize=(v:unknown)=>{if(c.type==="list"&&typeof v==="string"){try{return JSON.parse(v);}catch{}}return v;};const value=normalize(row[c.name]),old=normalize(before[c.name]);if(value!=null&&value!==""&&(!Array.isArray(value)||value.length)&&JSON.stringify(value)!==JSON.stringify(old))assertTablePermission(c.ref_table!,"read");if(value!=null&&value!==""&&JSON.stringify(value)!==JSON.stringify(old)){for(const id of Array.isArray(value)?value:[value]){const target=db.prepare(`SELECT * FROM "t_${c.ref_table}" WHERE id=?`).get(id) as any;if(target)assertRowAllowed(c.ref_table!,target);}}}}

export function assertFileAccess(id:string){const access=currentAccess();if(access.owner||access.builder)return;let referenced=false;for(const {name} of db.prepare("SELECT name FROM _tables").all() as {name:string}[])for(const c of columnsOf(name).filter(c=>c.type==="file"&&!c.is_virtual)){const rows=db.prepare('SELECT * FROM "t_'+name+'" WHERE "'+c.name+'"=?').all('/api/files/'+id) as Record<string,any>[];if(rows.length){referenced=true;if(canRead(name)&&rows.some(row=>rowAllowed(name,row)))return;}}if(!referenced&&Object.values(access.tables).some(t=>t.read&&(t.create||t.update))&&db.prepare('SELECT 1 FROM _file_uploads WHERE file_id=? AND user_id=?').get(id,currentUser()?.id))return;throw new AuthError('ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้',403);}
