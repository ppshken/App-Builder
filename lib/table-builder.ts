import {currentApplication} from './application-context';
import {columnsOf,db} from './db';
import {assertIdentifier} from './columns';
import {assertKeyData,insertColumn,normalizeColumns,saveColumn} from './metadata';
import {columnDefinition,createDefaultViews,createInlineViews,syncKeyIndex} from './schema';
import {createExternalReadView} from './external-storage';
import {backupBeforeSchema} from './database-backup';
import {dataColumnOrder} from './data-column-order';
export function createBuilderTable(raw:{name:unknown;label:unknown;columns:unknown},source:{kind:'INTERNAL_DATABASE'|'EXTERNAL_REST_API'|'IMPORTED_DATA';id:string}|null=null,allowEmpty=false){
 assertIdentifier(raw.name);const name=raw.name;if(db.prepare('SELECT 1 FROM _tables WHERE name=?').get(name))throw Error('มีตารางชื่อนี้แล้ว กรุณาใช้ชื่อในระบบอื่น');
 const cols=allowEmpty&&Array.isArray(raw.columns)&&!raw.columns.length?[]:normalizeColumns(raw.columns,{[name]:[]}),label=typeof raw.label==='string'&&raw.label.trim()?raw.label.trim():name;if(!db.inTransaction)backupBeforeSchema();
 return db.transaction(()=>{const app=currentApplication();db.prepare('INSERT INTO _tables(name,label,owner_app_id,source_kind,source_id) VALUES(?,?,?,?,?)').run(name,label,app?.id||'default',source?.kind||'INTERNAL_DATABASE',source?.id||null);if(app?.datasets)app.datasets[name]={read:true,create:source?.kind!=='EXTERNAL_REST_API',update:source?.kind!=='EXTERNAL_REST_API',delete:source?.kind!=='EXTERNAL_REST_API',export:true};cols.forEach(c=>insertColumn(name,c));
  if(source?.kind==='EXTERNAL_REST_API')createExternalReadView(db,name,cols,source.id);else{const physical=cols.filter(c=>!c.is_virtual);db.exec('CREATE TABLE "t_'+name+'"(id INTEGER PRIMARY KEY AUTOINCREMENT'+(physical.length?',':'')+physical.map(columnDefinition).join(',')+')');syncKeyIndex(db,name);}createDefaultViews(db,name,label);return {name,label,columns:cols};
 })();
}

export function addBuilderColumn(t:string,column:Record<string,unknown>){
  const cols=columnsOf(t);
  const all = normalizeColumns([...cols.map(c => ({ ...c, ...(column?.is_key ? { is_key: 0 } : {}), ...(column?.is_label && (c.type==="image")===(column.type==="image") ? { is_label: 0 } : {}) })), column],{[t]:[]}), c = all[all.length - 1];
  c.pos = c.is_virtual ? Math.max(-1, ...cols.map(c => c.pos ?? 0)) + 1 : all.filter(column=>!column.is_virtual).length-1;
  if(!db.inTransaction)backupBeforeSchema();
  db.transaction(() => {
    if (!c.is_virtual) db.prepare(`ALTER TABLE "t_${t}" ADD COLUMN ${columnDefinition(c)}`).run();
    insertColumn(t, c);
    all.slice(0, -1).forEach(c => saveColumn(t, c));
    if(!c.is_virtual){const position=db.prepare('UPDATE _columns SET pos=? WHERE table_name=? AND name=?');dataColumnOrder(all).forEach((column,index)=>position.run(index,t,column.name));}
    assertKeyData(t, all); syncKeyIndex(db, t); createInlineViews(db,t);
  })();
}
