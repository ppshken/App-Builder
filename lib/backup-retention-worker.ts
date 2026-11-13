import {databasePath} from './db';
import {runAutomaticBackupRetention} from './backup-retention';
const root=globalThis as typeof globalThis&{__backupRetentionTimer?:ReturnType<typeof setInterval>};
export function startBackupRetentionWorker(){if(root.__backupRetentionTimer)return;root.__backupRetentionTimer=setInterval(()=>{try{runAutomaticBackupRetention(databasePath);}catch{console.error('[backup-retention] ตรวจหรือล้างไฟล์ไม่สำเร็จ ไม่มีการข้ามการตรวจความปลอดภัย');}},5*60000);root.__backupRetentionTimer.unref();}
