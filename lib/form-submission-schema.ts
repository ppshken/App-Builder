// Operational receipts, never app definitions. Restore starts a new data timeline.
export const FORM_SUBMISSION_SCHEMA=`CREATE TABLE IF NOT EXISTS _form_submissions(
 scope_hash TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 result_json TEXT NOT NULL, expires_at INTEGER NOT NULL,
 PRIMARY KEY(scope_hash,request_key));
 CREATE INDEX IF NOT EXISTS _form_submission_expiry ON _form_submissions(expires_at);`;
