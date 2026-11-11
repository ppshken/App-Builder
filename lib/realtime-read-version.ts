import {db,databaseGeneration} from './db';
import {canRead} from './permissions';
// Same app/user scope and generation tokens as /api/realtime; no row values are exposed.
export function realtimeReadVersions(){return Object.fromEntries((db.prepare('SELECT t.name,COALESCE(v.revision,0) revision FROM _tables t LEFT JOIN _realtime_versions v ON v.table_name=t.name WHERE t.realtime_enabled=1').all() as {name:string;revision:number}[]).filter(t=>canRead(t.name)).map(t=>[t.name,databaseGeneration()+':'+t.revision]));}
