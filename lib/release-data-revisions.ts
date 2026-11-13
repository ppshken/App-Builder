import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
export const RELEASE_REVISION_SCHEMA='CREATE TABLE IF NOT EXISTS _release_data_versions(table_name TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0)';
const globals=['_users','_roles','_user_profiles','_application_members','_application_local_roles','_application_role_tables','_application_role_actions','_application_role_rows','_role_tables','_role_actions','_role_row_rules'];
export function releaseTrackedGlobals(database:Database.Database){return (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(t=>t.name).filter(name=>globals.includes(name)||/^(?:_a_[a-f0-9]{24})?_user_setting_(?:defs|values)$/.test(name));}
export function releaseRevisionTriggers(table:string){
 if(!/^[a-z_][a-z0-9_]{0,127}$/.test(table))throw Error('Invalid release tracking table');
 const prefix='_release_rev_'+createHash('sha256').update(table).digest('hex').slice(0,24);
 return ['INSERT','UPDATE','DELETE'].map(op=>({name:prefix+'_'+op.toLowerCase(),sql:'CREATE TRIGGER "'+prefix+'_'+op.toLowerCase()+'" AFTER '+op+' ON "'+table+'" BEGIN INSERT INTO _release_data_versions(table_name,revision) VALUES(\''+table+'\',1) ON CONFLICT(table_name) DO UPDATE SET revision=revision+1; END'}));
}
export function installReleaseTrackingFor(database:Database.Database,table:string){
 database.exec(RELEASE_REVISION_SCHEMA);
 if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))return;
 for(const trigger of releaseRevisionTriggers(table))if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger.name))database.exec(trigger.sql);
}
export function installReleaseRevisionTracking(database:Database.Database){
 for(const {name} of database.prepare('SELECT name FROM _tables').all() as {name:string}[])installReleaseTrackingFor(database,'t_'+name);
 for(const table of releaseTrackedGlobals(database))installReleaseTrackingFor(database,table);
}
export function removeReleaseRevisionTracking(database:Database.Database){for(const row of database.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all() as {name:string}[])if(/^_release_rev_[a-f0-9]{24}_(insert|update|delete)$/.test(row.name))database.exec('DROP TRIGGER "'+row.name+'"');}
export function releaseRevisionStamp(database:Database.Database,names:string[]){
 const tables=[...new Set([...names.map(n=>'t_'+n),...releaseTrackedGlobals(database)])].sort();
 const normalize=(s:string)=>s.trim().replace(/;$/,'');
 for(const table of tables)for(const trigger of releaseRevisionTriggers(table)){const found=database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger.name) as {sql:string}|undefined;if(!found||normalize(found.sql)!==normalize(trigger.sql))throw Error('ตัวติดตามข้อมูลก่อนเผยแพร่ไม่พร้อม กรุณารีสตาร์ทหรืออัปเกรดแอปก่อน');}
 return JSON.stringify([database.pragma('schema_version',{simple:true}),tables.map(table=>[table,(database.prepare('SELECT revision FROM _release_data_versions WHERE table_name=?').get(table) as {revision:number}|undefined)?.revision||0])]);
}
