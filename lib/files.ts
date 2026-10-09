import type {Column} from './columns';import {db} from './db';import {assertFileAccess} from './permissions';
export const MAX_FILE_BYTES=20*1024*1024;
export function fileName(value:string){const name=value.replace(/.*[\\/]/,'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,180);if(!name)throw Error('ชื่อไฟล์ไม่ถูกต้อง');return name;}
export function checkFiles(cols:Column[],row:Record<string,unknown>){for(const c of cols.filter(c=>c.type==='file'&&!c.is_virtual)){const value=row[c.name];if(typeof value==='string'&&value){const id=value.slice('/api/files/'.length);assertFileAccess(id);if(!db.prepare('SELECT 1 FROM _files WHERE id=?').get(id))throw Error('ไม่พบไฟล์ของ "'+c.label+'" กรุณาเลือกไฟล์ใหม่');}}}
