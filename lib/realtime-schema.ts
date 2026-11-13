import type Database from 'better-sqlite3';
import {installReleaseTrackingFor} from './release-data-revisions';
export const REALTIME_SCHEMA="CREATE TABLE IF NOT EXISTS _realtime_versions(table_name TEXT PRIMARY KEY REFERENCES _tables(name) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0)";
export function realtimeTriggerDefinitions(table:string){
 if(!/^[a-z][a-z0-9_]{0,40}$/.test(table))throw Error('Invalid realtime table');const literal="'"+table+"'";
 const config={name:'_rt_config_'+table,sql:'CREATE TRIGGER "_rt_config_'+table+'" AFTER UPDATE OF realtime_enabled ON _tables WHEN NEW.name='+literal+' AND OLD.realtime_enabled<>NEW.realtime_enabled BEGIN INSERT INTO _realtime_versions(table_name,revision) VALUES('+literal+',1) ON CONFLICT(table_name) DO UPDATE SET revision=revision+1; END'};
 return [config,...['INSERT','UPDATE','DELETE'].map(operation=>({name:'_rt_'+table+'_'+operation.toLowerCase(),sql:'CREATE TRIGGER "_rt_'+table+'_'+operation.toLowerCase()+'" AFTER '+operation+' ON "t_'+table+'" WHEN EXISTS(SELECT 1 FROM _tables WHERE name='+literal+' AND realtime_enabled=1) BEGIN INSERT INTO _realtime_versions(table_name,revision) VALUES('+literal+',1) ON CONFLICT(table_name) DO UPDATE SET revision=revision+1; END'}))];
}
export function installRealtimeTriggers(database:Database.Database,table:string){if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get('t_'+table))return;if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_realtime_versions'").get())return;installReleaseTrackingFor(database,'t_'+table);for(const t of realtimeTriggerDefinitions(table))if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(t.name))database.exec(t.sql);}
