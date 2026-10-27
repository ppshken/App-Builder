export const AUTH_TABLES = ["_builder_security","_application_builders","_application_local_roles","_application_members","_application_role_tables","_application_role_actions","_application_role_rows","_user_profiles", "_users", "_sessions", "_auth_attempts", "_roles", "_role_tables", "_role_actions", "_image_uploads", "_file_uploads", "_user_setting_defs", "_user_setting_values", "_role_row_rules"];
export const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS _roles(name TEXT PRIMARY KEY,label TEXT NOT NULL UNIQUE,builder INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO _roles VALUES('owner','เจ้าของแอป',1);
CREATE TABLE IF NOT EXISTS _role_tables(role_name TEXT NOT NULL REFERENCES _roles(name) ON DELETE CASCADE,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,can_read INTEGER NOT NULL DEFAULT 0,can_create INTEGER NOT NULL DEFAULT 0,can_update INTEGER NOT NULL DEFAULT 0,can_delete INTEGER NOT NULL DEFAULT 0,can_export INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(role_name,table_name));
CREATE TABLE IF NOT EXISTS _role_actions(role_name TEXT NOT NULL REFERENCES _roles(name) ON DELETE CASCADE,action_name TEXT NOT NULL REFERENCES _actions(name) ON DELETE CASCADE,PRIMARY KEY(role_name,action_name));
CREATE TABLE IF NOT EXISTS _users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'owner' REFERENCES _roles(name),active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,username TEXT NOT NULL DEFAULT '',nickname TEXT NOT NULL DEFAULT '',department TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS _sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS _file_uploads(file_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS _image_uploads(image_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS _user_setting_defs(name TEXT PRIMARY KEY,label TEXT NOT NULL,type TEXT NOT NULL,options_json TEXT NOT NULL DEFAULT '[]',default_json TEXT NOT NULL DEFAULT 'null');
CREATE TABLE IF NOT EXISTS _user_setting_values(user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE,name TEXT NOT NULL REFERENCES _user_setting_defs(name) ON DELETE CASCADE,value_json TEXT NOT NULL,PRIMARY KEY(user_id,name));
CREATE TABLE IF NOT EXISTS _role_row_rules(role_name TEXT NOT NULL REFERENCES _roles(name) ON DELETE CASCADE,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,operation TEXT NOT NULL,expression TEXT NOT NULL,PRIMARY KEY(role_name,table_name,operation));
CREATE TABLE IF NOT EXISTS _user_profiles(user_id INTEGER PRIMARY KEY REFERENCES _users(id) ON DELETE CASCADE,avatar TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS _sessions_user ON _sessions(user_id);
CREATE TABLE IF NOT EXISTS _auth_attempts(scope TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
`;

import type Database from "better-sqlite3";
export function migrateAuthRoles(db:Database.Database){
 db.exec(AUTH_SCHEMA);
 if(!(db.pragma("foreign_key_list('_users')") as {from:string}[]).some(f=>f.from==="role")){
  for(const r of db.prepare("SELECT DISTINCT role FROM _users").all() as {role:string}[])db.prepare("INSERT OR IGNORE INTO _roles VALUES(?,?,0)").run(r.role,r.role);
  const seq=(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='_users'").get() as {seq:number}|undefined)?.seq||0;
  db.exec("CREATE TABLE _users__new(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'owner' REFERENCES _roles(name),active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL); INSERT INTO _users__new SELECT * FROM _users; DROP TABLE _users; ALTER TABLE _users__new RENAME TO _users;");
  if(!db.prepare("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name='_users'").run(seq).changes)db.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES('_users',?)").run(seq);
 }
}

/** Called with foreign keys OFF within the schema migration transaction. */
export function migrateAccountIdentity(db:Database.Database){
 const fields=db.pragma("table_info('_users')") as {name:string;notnull:number}[],names=new Set(fields.map(c=>c.name));
 if(!names.has('username')||fields.find(c=>c.name==='email')?.notnull){
  const seq=(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='_users'").get() as {seq:number}|undefined)?.seq||0;
  db.exec("CREATE TABLE _users__identity(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'owner' REFERENCES _roles(name),active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,username TEXT NOT NULL DEFAULT '',nickname TEXT NOT NULL DEFAULT '',department TEXT NOT NULL DEFAULT '')");
  const username=names.has('username')?'username':"COALESCE(NULLIF(lower(email),''),'user_'||id)",nickname=names.has('nickname')?'nickname':'name',department=names.has('department')?'department':"''";
  db.exec(`INSERT INTO _users__identity SELECT id,name,NULLIF(email,''),password_hash,role,active,created_at,${username},${nickname},${department} FROM _users; DROP TABLE _users; ALTER TABLE _users__identity RENAME TO _users;`);
  if(!db.prepare("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name='_users'").run(seq).changes)db.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES('_users',?)").run(seq);
 }
 db.exec("CREATE UNIQUE INDEX IF NOT EXISTS _users_username ON _users(username COLLATE NOCASE) WHERE username<>''; CREATE UNIQUE INDEX IF NOT EXISTS _users_email ON _users(email COLLATE NOCASE) WHERE email IS NOT NULL AND email<>''");
}
