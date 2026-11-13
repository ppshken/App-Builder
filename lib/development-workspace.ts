import type Database from 'better-sqlite3';
import type {ApplicationScope} from './application-context';
import type {AppAccess,TableAccess} from './access';

export function initializeDevelopment(database:Database.Database,id:string,appId:string,tables:string[]){
  database.exec(`CREATE TABLE _development_workspace(id TEXT PRIMARY KEY,source_app_id TEXT NOT NULL);
CREATE TABLE _development_objects(uid TEXT PRIMARY KEY,kind TEXT NOT NULL,local_key TEXT NOT NULL,table_name TEXT NOT NULL,name TEXT NOT NULL,source_key TEXT,source_table TEXT,retired INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX _development_object_active ON _development_objects(kind,local_key) WHERE retired=0;`);
  database.prepare('INSERT INTO _development_workspace VALUES(?,?)').run(id,appId);
  const record=database.prepare("INSERT INTO _development_objects(uid,kind,local_key,table_name,name,source_key,source_table) VALUES(lower(hex(randomblob(16))),?,?,?,?,?,?)");
  for(const table of tables){
    record.run('table',table,table,table,table,table);
    for(const column of database.prepare('SELECT id,name FROM _columns WHERE table_name=?').all(table) as {id:number;name:string}[])record.run('column',String(column.id),table,column.name,String(column.id),table);
  }
  // SQLite triggers keep identity updates in the same transaction as existing schema handlers.
  database.exec(`CREATE TRIGGER _development_table_insert AFTER INSERT ON _tables BEGIN
INSERT INTO _development_objects(uid,kind,local_key,table_name,name) VALUES(lower(hex(randomblob(16))),'table',NEW.name,NEW.name,NEW.name);END;
CREATE TRIGGER _development_table_delete AFTER DELETE ON _tables BEGIN UPDATE _development_objects SET retired=1 WHERE kind='table' AND local_key=OLD.name AND retired=0;END;
CREATE TRIGGER _development_column_insert AFTER INSERT ON _columns BEGIN
INSERT INTO _development_objects(uid,kind,local_key,table_name,name) VALUES(lower(hex(randomblob(16))),'column',CAST(NEW.id AS TEXT),NEW.table_name,NEW.name);END;
CREATE TRIGGER _development_column_delete AFTER DELETE ON _columns BEGIN UPDATE _development_objects SET retired=1 WHERE kind='column' AND local_key=CAST(OLD.id AS TEXT) AND retired=0;END;
CREATE TRIGGER _development_column_update AFTER UPDATE OF name,table_name ON _columns BEGIN UPDATE _development_objects SET name=NEW.name,table_name=NEW.table_name WHERE kind='column' AND local_key=CAST(OLD.id AS TEXT) AND retired=0;END;
DELETE FROM _sessions;
UPDATE _users SET password_hash='';
DELETE FROM _push_subscriptions;`);
}
export function verifyDevelopment(database:Database.Database,id:string,appId:string){
  const row=database.prepare('SELECT id,source_app_id FROM _development_workspace').get() as {id:string;source_app_id:string}|undefined;
  if(row?.id!==id||row.source_app_id!==appId)throw Error('พื้นที่พัฒนาไม่ตรงกับแอปต้นทาง กรุณาสร้างพื้นที่พัฒนาใหม่');
}
export function developmentAccess(database:Database.Database,application:ApplicationScope,access:AppAccess){
  const datasets:Record<string,TableAccess>={};
  for(const [name,rights]of Object.entries(application.datasets||{}))datasets[name]={...rights,create:false,update:false,delete:false};
  const owned=database.prepare("SELECT t.name,o.source_key FROM _tables t JOIN _development_objects o ON o.kind='table' AND o.local_key=t.name AND o.retired=0 WHERE t.owner_app_id=? AND t.source_kind<>'EXTERNAL_REST_API'").all(application.id) as {name:string;source_key:string|null}[];
  for(const table of owned)if(!table.source_key||application.datasets?.[table.name]?.read)datasets[table.name]={read:true,create:true,update:true,delete:true,export:true};
  return {application:{...application,datasets},access:{...access,datasets}};
}
export function developmentOrigins(database:Database.Database){
  const rows=database.prepare('SELECT uid,kind,local_key,source_key,table_name FROM _development_objects WHERE retired=0').all() as {uid:string;kind:string;local_key:string;source_key:string|null;table_name:string}[];
  return {tables:Object.fromEntries(rows.filter(r=>r.kind==='table').map(r=>[r.local_key,{uid:r.uid,sourceKey:r.source_key}])),columns:Object.fromEntries(rows.filter(r=>r.kind==='column').map(r=>[r.table_name+':'+r.local_key,{uid:r.uid,sourceKey:r.source_key}]))};
}
