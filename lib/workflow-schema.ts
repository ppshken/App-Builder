export const WORKFLOW_SCHEMA=`
CREATE TABLE IF NOT EXISTS _automations(name TEXT PRIMARY KEY,label TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name),enabled INTEGER NOT NULL DEFAULT 0,event TEXT NOT NULL,config_json TEXT NOT NULL,owner_id INTEGER NOT NULL,next_run_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS _pdf_templates(name TEXT PRIMARY KEY,label TEXT NOT NULL,table_name TEXT NOT NULL REFERENCES _tables(name),config_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS _automation_jobs(id TEXT PRIMARY KEY,automation_name TEXT NOT NULL,label TEXT NOT NULL,table_name TEXT NOT NULL,row_id INTEGER NOT NULL,actor_id INTEGER NOT NULL,event TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,next_step INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,config_json TEXT NOT NULL,row_json TEXT NOT NULL,outputs_json TEXT NOT NULL DEFAULT '[]',error TEXT NOT NULL DEFAULT '',UNIQUE(automation_name,event,id));
CREATE INDEX IF NOT EXISTS _automation_queue ON _automation_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS _automation_history ON _automation_jobs(created_at);
CREATE INDEX IF NOT EXISTS _automation_events ON _automations(table_name,event,enabled);
`;
