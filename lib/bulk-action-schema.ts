// Operational idempotency ledger, deliberately outside per-app definition tables.
export const BULK_ACTION_SCHEMA=`CREATE TABLE IF NOT EXISTS _bulk_action_state(id INTEGER PRIMARY KEY CHECK(id=1),epoch TEXT NOT NULL);
 INSERT OR IGNORE INTO _bulk_action_state VALUES(1,lower(hex(randomblob(16))));
 CREATE TABLE IF NOT EXISTS _bulk_action_runs(
 app_id TEXT NOT NULL, actor_id INTEGER NOT NULL, request_key TEXT NOT NULL,
 total INTEGER NOT NULL, request_hash TEXT NOT NULL, definition_hash TEXT NOT NULL, results_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL, lease_token TEXT NOT NULL, lease_until INTEGER NOT NULL,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(app_id,actor_id,request_key));
 CREATE INDEX IF NOT EXISTS _bulk_action_activity ON _bulk_action_runs(app_id,actor_id,created_at);
 CREATE INDEX IF NOT EXISTS _bulk_action_lease ON _bulk_action_runs(status,lease_until);`;
