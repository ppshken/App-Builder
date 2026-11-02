import type Database from 'better-sqlite3';
/** Add provenance once. Legacy views have no origin metadata; only recognize default names/labels. */
export function migrateSystemViews(database:Database.Database,table='_views'){
  if(!/^_(?:a_[a-f0-9]{24}_)?views$/.test(table)&&table!=='_views')throw Error('Invalid views table');
  const quoted='"'+table+'"';
  if((database.pragma('table_info('+quoted+')') as {name:string}[]).some(c=>c.name==='system_generated'))return;
  database.exec('ALTER TABLE '+quoted+' ADD COLUMN system_generated INTEGER NOT NULL DEFAULT 0');
  database.exec(`UPDATE ${quoted} SET system_generated=1 WHERE position='ref' AND slice_name IS NULL AND name GLOB 'view_[0-9]*' AND substr(name,6) NOT GLOB '*[^0-9]*' AND EXISTS(SELECT 1 FROM _tables t WHERE t.name=${quoted}.table_name AND ${quoted}.label=t.label || CASE ${quoted}.kind WHEN 'detail' THEN ' · รายละเอียด' WHEN 'form' THEN ' · ฟอร์ม' ELSE char(0) END)`);
}
