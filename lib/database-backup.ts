import {db,databasePath,isIsolatedDatabase} from "./db";
import {createBackup} from "./backups";
export function backupBeforeSchema(){if(isIsolatedDatabase())return;if(db.prepare("SELECT 1 FROM _tables LIMIT 1").get())return createBackup(db,databasePath,"schema");}
