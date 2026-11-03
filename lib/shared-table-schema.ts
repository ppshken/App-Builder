// Physical schema stays global. These records contain only per-app presentation/formulas.
export const MAX_SHARED_TABLE_SELECTION=50;
export const SHARED_TABLE_SCHEMA=`
CREATE TABLE IF NOT EXISTS _table_shares(table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,target_app_id TEXT NOT NULL REFERENCES _applications(id) ON DELETE CASCADE,can_read INTEGER NOT NULL DEFAULT 1 CHECK(can_read IN (0,1)),can_create INTEGER NOT NULL DEFAULT 0 CHECK(can_create IN (0,1)),can_update INTEGER NOT NULL DEFAULT 0 CHECK(can_update IN (0,1)),can_delete INTEGER NOT NULL DEFAULT 0 CHECK(can_delete IN (0,1)),can_export INTEGER NOT NULL DEFAULT 0 CHECK(can_export IN (0,1)),PRIMARY KEY(table_name,target_app_id));
CREATE TABLE IF NOT EXISTS _table_overlays(table_name TEXT PRIMARY KEY REFERENCES _tables(name) ON DELETE CASCADE,config_json TEXT NOT NULL);
`;
