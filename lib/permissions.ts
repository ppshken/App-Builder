import {securitySeparated,applicationBuilder} from './builder-security';
import {applicationMember,memberCanUse} from './application-membership';
import {currentApplication} from './application-context';
import {actionPermission} from "./action-config";
import {rowAllowed,assertRowAllowed} from "./row-access";
import {AsyncLocalStorage} from "node:async_hooks";
import type Database from "better-sqlite3";
import {db,columnsOf} from "./db";
import {AuthError,type AuthUser} from "./auth";
import {NO_ACCESS,tableAccess,type AppAccess,type TableAccess} from "./access";
const scope=new AsyncLocalStorage<{user:AuthUser;access:AppAccess}>();
export function accessFor(user:AuthUser|null,database:Database.Database=db):AppAccess{
 const application=currentApplication(),datasets=application?.datasets;
 if(!user)return NO_ACCESS;if(user.role==="owner")return {owner:true,builder:true,tables:{},actions:[],...(datasets?{datasets}:{})};
 const separated=securitySeparated(database);if(separated&&application&&applicationBuilder(database,application.id,user.id)){const member=applicationMember(database,application.id,user.id),local=member&&memberCanUse(member)?{name:member.role_name!,label:member.label!}:undefined;return {owner:false,builder:true,tables:{},actions:[],...(datasets?{datasets}:{}),...(local?{applicationRole:local}:{}),effectiveRole:local||{name:user.role,label:(database.prepare('SELECT label FROM _roles WHERE name=?').get(user.role) as {label:string})?.label||user.role}};}
 if(application){const member=applicationMember(database,application.id,user.id);if(member){if(!memberCanUse(member))return NO_ACCESS;const role={name:member.role_name!,label:member.label!},tables:AppAccess['tables']={};for(const g of database.prepare('SELECT * FROM _application_role_tables WHERE app_id=? AND role_name=?').all(application.id,role.name) as any[])tables[g.table_name]={read:!!g.can_read,create:!!g.can_create,update:!!g.can_update,delete:!!g.can_delete,export:!!g.can_export};if(datasets)for(const name of Object.keys(tables))tables[name]=tableAccess({owner:false,builder:false,tables,actions:[],datasets},name);return {owner:false,builder:false,tables,actions:(database.prepare('SELECT action_name FROM _application_role_actions WHERE app_id=? AND role_name=?').all(application.id,role.name) as {action_name:string}[]).map(g=>g.action_name),rowRules:Object.fromEntries((database.prepare('SELECT table_name,operation,expression FROM _application_role_rows WHERE app_id=? AND role_name=?').all(application.id,role.name) as {table_name:string;operation:string;expression:string}[]).map(g=>[g.table_name+':'+g.operation,g.expression])),applicationRole:role,effectiveRole:role,...(datasets?{datasets}:{})};}}
 if(separated)return NO_ACCESS;
 const role=database.prepare("SELECT builder,label FROM _roles WHERE name=?").get(user.role) as {builder:number;label:string}|undefined;if(!role)return NO_ACCESS;
 const tables:AppAccess['tables']={};for(const g of database.prepare("SELECT * FROM _role_tables WHERE role_name=?").all(user.role) as any[])tables[g.table_name]={read:!!g.can_read,create:!!g.can_create,update:!!g.can_update,delete:!!g.can_delete,export:!!g.can_export};
 const membership=application?.id&&application.id!=='default'?database.prepare('SELECT can_use,builder FROM _application_roles WHERE app_id=? AND role_name=?').get(application.id,user.role) as {can_use:number;builder:number}|undefined:undefined;if(application?.id&&application.id!=='default'&&!membership?.can_use)return NO_ACCESS;
 const builder=!!role.builder&&(!application||application.id==='default'||!!membership?.builder);if(datasets)for(const name of Object.keys(tables))tables[name]=tableAccess({owner:false,builder,tables,actions:[],datasets},name);
 return {owner:false,builder,tables,...(application?{effectiveRole:{name:user.role,label:role.label}}:{}),...(datasets?{datasets}:{}),actions:(database.prepare("SELECT action_name FROM _role_actions WHERE role_name=?").all(user.role) as {action_name:string}[]).map(g=>g.action_name)};
}
export function runAuthorized<T>(user:AuthUser,access:AppAccess,work:()=>T){return scope.run({user,access},work);}
export function currentScopeKey(){return scope.getStore();}
export function currentUser(){return scope.getStore()?.user;}
export function currentAccess(){return scope.getStore()?.access || {owner:true,builder:true,tables:{},actions:[]};}
export function canRead(table:string){return tableAccess(currentAccess(),table).read;}
export function assertTablePermission(table:string,operation:"read"|"create"|"update"|"delete"){if(!tableAccess(currentAccess(),table)[operation])throw new AuthError("ไม่มีสิทธิ์"+({read:"ดู",create:"เพิ่ม",update:"แก้ไข",delete:"ลบ"}[operation])+"ข้อมูลของตารางนี้",403);}
export function canExecuteAction(action:{name:string;table_name:string;kind:string}){const a=currentAccess();return tableAccess(a,action.table_name).read && tableAccess(a,action.table_name)[actionPermission(action.kind)] && (a.owner||a.builder||a.actions.includes(action.name));}
export function assertImageAccess(id:string){
 if(currentAccess().owner&&!db.prepare("SELECT 1 FROM _images WHERE id=?").get(id))return;
 const access=currentAccess();if((access.owner||access.builder)&&!access.datasets)return;
 const setting=db.prepare('SELECT icon_image,header_json FROM _app_settings WHERE id=1').get() as {icon_image?:string;header_json?:string}|undefined;if(setting?.icon_image==='/api/images/'+id||JSON.parse(setting?.header_json||'{}').app_image==='/api/images/'+id)return;
 let referenced=false;for(const {name} of (db.prepare("SELECT name FROM _tables").all() as {name:string}[]).filter(t=>canRead(t.name)))for(const c of columnsOf(name).filter(c=>["image","signature"].includes(c.type)&&!c.is_virtual)){
  const rows=db.prepare('SELECT * FROM "t_'+name+'" WHERE "'+c.name+'"=?').all('/api/images/'+id) as any[];if(rows.length){referenced=true;if(canRead(name)&&rows.some(row=>rowAllowed(name,row)))return;}
 }
 if(!referenced && (access.builder||Object.values(access.tables).some(t=>t.read&&(t.create||t.update))) && db.prepare("SELECT 1 FROM _image_uploads WHERE image_id=? AND user_id=?").get(id,currentUser()?.id))return;
 throw new AuthError("ไม่มีสิทธิ์ดูรูปภาพนี้",403);
}

import type {Column} from "./columns";
export function assertReferenceWrites(cols:Column[],row:Record<string,unknown>,before:Record<string,unknown>={}){for(const c of cols.filter(c=>!c.is_virtual&&c.ref_table&&(c.type==="ref"||c.type==="list"))){const normalize=(v:unknown)=>{if(c.type==="list"&&typeof v==="string"){try{return JSON.parse(v);}catch{}}return v;};const value=normalize(row[c.name]),old=normalize(before[c.name]);if(value!=null&&value!==""&&(!Array.isArray(value)||value.length)&&JSON.stringify(value)!==JSON.stringify(old))assertTablePermission(c.ref_table!,"read");if(value!=null&&value!==""&&JSON.stringify(value)!==JSON.stringify(old)){for(const id of Array.isArray(value)?value:[value]){const target=db.prepare(`SELECT * FROM "t_${c.ref_table}" WHERE id=?`).get(id) as any;if(target)assertRowAllowed(c.ref_table!,target);}}}}

export function assertFileAccess(id:string){if(currentAccess().owner&&!db.prepare("SELECT 1 FROM _files WHERE id=?").get(id))return;const access=currentAccess();if(access.owner||access.builder)return;let referenced=false;for(const {name} of (db.prepare("SELECT name FROM _tables").all() as {name:string}[]).filter(t=>canRead(t.name)))for(const c of columnsOf(name).filter(c=>c.type==="file"&&!c.is_virtual)){const rows=db.prepare('SELECT * FROM "t_'+name+'" WHERE "'+c.name+'"=?').all('/api/files/'+id) as Record<string,any>[];if(rows.length){referenced=true;if(canRead(name)&&rows.some(row=>rowAllowed(name,row)))return;}}if(!referenced&&(access.builder||Object.values(access.tables).some(t=>t.read&&(t.create||t.update)))&&db.prepare('SELECT 1 FROM _file_uploads WHERE file_id=? AND user_id=?').get(id,currentUser()?.id))return;throw new AuthError('ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้',403);}

export function canExport(table:string){const rights=tableAccess(currentAccess(),table);return rights.read&&!!rights.export;}
export function assertExcelExport(table:string){if(!canExport(table))throw new AuthError("ไม่มีสิทธิ์ส่งออก Excel ของตารางนี้",403);}
