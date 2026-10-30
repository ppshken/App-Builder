import {currentApplication} from './application-context';
import {db} from './db';
import {assertIdentifier} from './columns';
import {insertColumn,normalizeColumns} from './metadata';
import {columnDefinition,createDefaultViews,syncKeyIndex} from './schema';
import {createExternalReadView} from './external-storage';
import {backupBeforeSchema} from './database-backup';
export function createBuilderTable(raw:{name:unknown;label:unknown;columns:unknown},source:{kind:'INTERNAL_DATABASE'|'EXTERNAL_REST_API'|'IMPORTED_DATA';id:string}|null=null){
 assertIdentifier(raw.name);const name=raw.name;if(db.prepare('SELECT 1 FROM _tables WHERE name=?').get(name))throw Error('มีตารางชื่อนี้แล้ว กรุณาใช้ชื่อในระบบอื่น');
 const cols=normalizeColumns(raw.columns,{[name]:[]}),label=typeof raw.label==='string'&&raw.label.trim()?raw.label.trim():name;if(!db.inTransaction)backupBeforeSchema();
 return db.transaction(()=>{const app=currentApplication();db.prepare('INSERT INTO _tables(name,label,owner_app_id,source_kind,source_id) VALUES(?,?,?,?,?)').run(name,label,app?.id||'default',source?.kind||'INTERNAL_DATABASE',source?.id||null);if(app?.datasets)app.datasets[name]={read:true,create:source?.kind!=='EXTERNAL_REST_API',update:source?.kind!=='EXTERNAL_REST_API',delete:source?.kind!=='EXTERNAL_REST_API',export:true};cols.forEach(c=>insertColumn(name,c));
  if(source?.kind==='EXTERNAL_REST_API')createExternalReadView(db,name,cols,source.id);else{const physical=cols.filter(c=>!c.is_virtual);db.exec('CREATE TABLE "t_'+name+'"(id INTEGER PRIMARY KEY AUTOINCREMENT'+(physical.length?',':'')+physical.map(columnDefinition).join(',')+')');syncKeyIndex(db,name);}createDefaultViews(db,name,label);return {name,label,columns:cols};
 })();
}
