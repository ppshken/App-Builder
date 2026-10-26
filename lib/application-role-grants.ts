import type Database from 'better-sqlite3';
import {currentApplication,withApplication} from './application-context';
import {applicationIds} from './application-schema';
/** Run inside the metadata mutation transaction. A removed resource must not retain a grant if its name is reused. */
export function pruneApplicationActionGrants(database:Database.Database,allApplications=false){const ids=allApplications?applicationIds(database):[currentApplication()?.id||'default'];for(const id of ids)withApplication({id},()=>database.prepare('DELETE FROM _application_role_actions WHERE app_id=? AND action_name NOT IN (SELECT name FROM _actions)').run(id));}
