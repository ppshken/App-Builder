import {migrateSystemViews} from "./system-views";
import type Database from 'better-sqlite3';
import {APPLICATION_CONFIG_TABLES,applicationSql,applicationTable,validApplicationId} from './application-context';
export const APPLICATION_SCHEMA=`
CREATE TABLE IF NOT EXISTS _applications(id TEXT PRIMARY KEY,label TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
INSERT OR IGNORE INTO _applications(id,label,created_at) SELECT 'default',name,0 FROM _app_settings WHERE id=1;
CREATE TABLE IF NOT EXISTS _application_datasets(app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,can_read INTEGER NOT NULL DEFAULT 1,can_create INTEGER NOT NULL DEFAULT 0,can_update INTEGER NOT NULL DEFAULT 0,can_delete INTEGER NOT NULL DEFAULT 0,can_export INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(app_id,table_name));
CREATE TABLE IF NOT EXISTS _application_roles(app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,role_name TEXT NOT NULL REFERENCES _roles(name) ON DELETE CASCADE,can_use INTEGER NOT NULL DEFAULT 0,builder INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(app_id,role_name));
CREATE TABLE IF NOT EXISTS _application_local_roles(app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,name TEXT NOT NULL,label TEXT NOT NULL COLLATE NOCASE,auto_grant INTEGER NOT NULL DEFAULT 0 CHECK(auto_grant IN (0,1)),PRIMARY KEY(app_id,name),UNIQUE(app_id,label));
CREATE TABLE IF NOT EXISTS _application_members(app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE,role_name TEXT,can_use INTEGER NOT NULL DEFAULT 0 CHECK(can_use IN (0,1)),PRIMARY KEY(app_id,user_id),FOREIGN KEY(app_id,role_name) REFERENCES _application_local_roles(app_id,name) ON DELETE RESTRICT,CHECK(can_use=0 OR role_name IS NOT NULL));
CREATE TABLE IF NOT EXISTS _application_role_tables(app_id TEXT NOT NULL,role_name TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,can_read INTEGER NOT NULL DEFAULT 0,can_create INTEGER NOT NULL DEFAULT 0,can_update INTEGER NOT NULL DEFAULT 0,can_delete INTEGER NOT NULL DEFAULT 0,can_export INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(app_id,role_name,table_name),FOREIGN KEY(app_id,role_name) REFERENCES _application_local_roles(app_id,name) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS _application_role_actions(app_id TEXT NOT NULL,role_name TEXT NOT NULL,action_name TEXT NOT NULL,PRIMARY KEY(app_id,role_name,action_name),FOREIGN KEY(app_id,role_name) REFERENCES _application_local_roles(app_id,name) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS _application_role_rows(app_id TEXT NOT NULL,role_name TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,operation TEXT NOT NULL CHECK(operation IN ('read','create','update','delete')),expression TEXT NOT NULL,PRIMARY KEY(app_id,role_name,table_name,operation),FOREIGN KEY(app_id,role_name) REFERENCES _application_local_roles(app_id,name) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS _builder_security(id INTEGER PRIMARY KEY CHECK(id=1),separated INTEGER NOT NULL DEFAULT 0 CHECK(separated IN (0,1)));
CREATE TABLE IF NOT EXISTS _application_builders(app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE,PRIMARY KEY(app_id,user_id));
CREATE INDEX IF NOT EXISTS _application_members_user ON _application_members(user_id,app_id);

`;
export const APPLICATION_PLATFORM_TABLES=['_applications','_application_datasets','_application_roles'];
export function applicationIds(database:Database.Database){if(!database.prepare("SELECT 1 FROM sqlite_master WHERE name='_applications' AND type='table'").get())return [];const rows=database.prepare('SELECT id FROM _applications ORDER BY id').all() as {id:string}[];if(rows.length>200)throw Error('รองรับไม่เกิน 200 แอป');for(const row of rows)if(!validApplicationId(row.id))throw Error('รหัสแอปในฐานข้อมูลไม่ถูกต้อง');return rows.map(r=>r.id);}
export function configurationTables(database:Database.Database){return applicationIds(database).filter(id=>id!=='default').flatMap(id=>APPLICATION_CONFIG_TABLES.map(table=>applicationTable(id,table)));}
export function createApplicationConfig(database:Database.Database,id:string,label?:string){if(id==='default')return;
 for(const table of APPLICATION_CONFIG_TABLES){const source=database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as {sql:string}|undefined;if(!source)throw Error('โครงสร้างการตั้งค่าแอปไม่ครบ');const target=applicationTable(id,table);database.exec(applicationSql(source.sql.replace(/CREATE TABLE /i,'CREATE TABLE IF NOT EXISTS '),id));
 if(table==='_views')migrateSystemViews(database,target);
 // Forward-compatible additions follow the default schema on future upgrades.
 const columns=database.pragma('table_info("'+target+'")') as {name:string}[],known=new Set(columns.map(c=>c.name));for(const c of database.pragma('table_info("'+table+'")') as {name:string;type:string;notnull:number;dflt_value:string|null}[]){if(!known.has(c.name))database.exec('ALTER TABLE "'+target+'" ADD COLUMN "'+c.name+'" '+c.type+(c.notnull?' NOT NULL':'')+(c.dflt_value===null?'':' DEFAULT '+c.dflt_value));}}
 database.prepare('INSERT OR IGNORE INTO "'+applicationTable(id,'_app_settings')+'"(id,name,icon,color,mode,list_reference_version) VALUES(1,?,?,?,?,1)').run(label||'แอปใหม่','grid','blue','auto');
 installReleaseTrackingFor(database,applicationTable(id,'_user_setting_values'));installReleaseTrackingFor(database,applicationTable(id,'_user_setting_defs'));
 const jobs=applicationTable(id,'_automation_jobs');database.exec('CREATE INDEX IF NOT EXISTS "'+jobs+'_queue" ON "'+jobs+'"(status,created_at)');
}
import {installReleaseTrackingFor} from './release-data-revisions';
