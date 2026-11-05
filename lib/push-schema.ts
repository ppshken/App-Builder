export const PUSH_SCHEMA=`
CREATE TABLE IF NOT EXISTS _push_subscriptions(id TEXT PRIMARY KEY,app_id TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES _users(id) ON DELETE CASCADE,session_hash TEXT NOT NULL REFERENCES _sessions(token_hash) ON DELETE CASCADE,endpoint_hash TEXT NOT NULL,subscription_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(app_id,endpoint_hash));
CREATE INDEX IF NOT EXISTS _push_user ON _push_subscriptions(app_id,user_id);
CREATE TABLE IF NOT EXISTS _push_deliveries(app_id TEXT NOT NULL,job_id TEXT NOT NULL,step INTEGER NOT NULL,subscription_id TEXT NOT NULL REFERENCES _push_subscriptions(id) ON DELETE CASCADE,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(app_id,job_id,step,subscription_id));
CREATE INDEX IF NOT EXISTS _push_expiry ON _push_deliveries(created_at);
CREATE INDEX IF NOT EXISTS _push_delivery_time ON _push_deliveries(app_id,created_at);
`;
