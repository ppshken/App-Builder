import {isRemoteImageSource} from './image-source';
import {createUserFieldValidator} from './user-fields';
import {convertValue,prepareConversion,referenceResolver} from './column-conversion';
import {realtimeTriggerDefinitions} from './realtime-schema';
import {releaseRevisionTriggers} from './release-data-revisions';
import {importReleaseSeedData,type ReleaseSeedData,type SeedSummary} from './release-seed-data';
import {preservingColumnTypeChange,releaseColumnRename,releaseColumnRemoval,releaseValueRewrite} from './release-column-types';
import {assertPartValues} from './part-validation';
import {assertPartSchema} from './part-of-config';
import {createHash} from 'node:crypto';
import type Database from 'better-sqlite3';
import {mergeReleaseCatalogScope,type ReleaseCatalog,type ReleasePlan} from './release-plan';
import {currentApplication} from './application-context';
import {assertIdentifier,calculateRow,validateRow,formState,SQLTYPE,type Column} from './columns';
import {isBlank} from './expression';
import {columnDefinition,syncKeyIndex,readColumns,rebuildTable} from './schema';
import {expressionContext} from './expression-context';
import {installRealtimeTriggers} from './realtime-schema';
import {currentDevelopment} from './development-context';
import {verifyDevelopment} from './development-workspace';
// Bump when the schema executor or its safety contract changes; old rehearsal proofs must expire.
export const RELEASE_EXECUTOR_VERSION='validated-publication-2026-11-19-v17-new-reference-target';
export const REHEARSAL_SAMPLE_ROWS=100;
export const REHEARSAL_SAMPLE_LIMIT=1000;
// Deterministic head/tail samples; keep the complete database for Ref/formula accuracy.
export function rehearsalRows(table:string,limit?:number,fields='*'){
 assertIdentifier(table);const from=' FROM "t_'+table+'"';if(limit===undefined)return {sql:'SELECT '+fields+from+' ORDER BY id',args:[] as number[]};
 if(!Number.isSafeInteger(limit)||limit<0)throw Error('จำนวนตัวอย่างไม่ถูกต้อง');const head=Math.ceil(limit/2),tail=Math.floor(limit/2);return {sql:'SELECT '+fields+from+' WHERE id IN (SELECT id FROM (SELECT id'+from+' ORDER BY id LIMIT ?) UNION SELECT id FROM (SELECT id'+from+' ORDER BY id DESC LIMIT ?)) ORDER BY id',args:[head,tail]};
}
export const PUBLICATION_VALIDATION_LIMIT=2000;
/** Evaluates existing formulas without persisting calculated values or exposing row values. */
export type ReleaseRowIssue={table:string;tableLabel:string;column:string|null;columnLabel:string;kind:'calculation'|'required'|'validation'|'related'|'unknown';count:number};
export function validateReleaseRows(database:Database.Database,names:string[],options:{limit:number;deadline:number;email:string;now:Date;checkpoint?:(checked:number)=>void;collectIssues?:boolean;samplePerTable?:number}){
 let checked=0,invalid=0,omittedIssueRows=0;const issues=new Map<string,ReleaseRowIssue>();
 for(const table of [...new Set(names)].sort()){
  assertIdentifier(table);const cols=readColumns(database,table);
  const tableLabel=options.collectIssues?String((database.prepare('SELECT label FROM _tables WHERE name=?').get(table) as {label:string}|undefined)?.label||table):table;
  const record=(column:string|null,kind:ReleaseRowIssue['kind'],label?:string)=>{if(!options.collectIssues)return;const key=JSON.stringify([table,column,kind]),existing=issues.get(key);if(existing){existing.count++;return;}if(issues.size>=200){omittedIssueRows++;return;}issues.set(key,{table,tableLabel,column,columnLabel:label||cols.find(c=>c.name===column)?.label||column||'ไม่สามารถระบุคอลัมน์',kind,count:1});};
  const parts=(database.prepare("SELECT table_name,name FROM _columns WHERE type='ref' AND is_virtual=0 AND ref_table=? AND (related_required=1 OR (is_part_of=1 AND part_valid_if IS NOT NULL AND part_valid_if<>''))").all(table) as {table_name:string;name:string}[]).map(p=>{assertIdentifier(p.table_name);assertIdentifier(p.name);return {table:p.table_name,link:readColumns(database,p.table_name).find(c=>c.name===p.name)!,query:database.prepare('SELECT id FROM "t_'+p.table_name+'" WHERE "'+p.name+'"=? ORDER BY id')};});
  const context=expressionContext(options.now,options.email,database),query=rehearsalRows(table,options.samplePerTable===undefined?undefined:Math.min(options.samplePerTable,Math.max(0,options.limit-checked)));
  for(const raw of database.prepare(query.sql).iterate(...query.args) as Iterable<Record<string,unknown>>){
   if(++checked>options.limit||Date.now()>options.deadline)throw Error('ข้อมูลเกินขีดจำกัดการตรวจสูตร กรุณาแบ่งแผนเผยแพร่');
   if(checked%100===0)options.checkpoint?.(checked);
   try{
    let rowInvalid=false;const calculated=calculateRow(cols,raw,false,options.now,false,options.email,context),column=Object.keys(calculated.errors)[0];
    if(column){rowInvalid=true;invalid++;record(column,'calculation');}
    else if(options.collectIssues){
     // Same first-error order as validateRow; never persist exception text or row values.
     const state=formState(cols,calculated.row,options.now,options.email,context),error=Object.keys(state.errors)[0],validation=Object.keys(state.validation)[0];
     if(error||validation){rowInvalid=true;invalid++;const name=error||validation;record(name,error?'calculation':state.required[name]&&isBlank(state.row[name])?'required':'validation');}
    }else validateRow(cols,calculated.row,options.now,options.email,context);
    if(!rowInvalid)for(const part of parts){try{const ids=(part.query.all(raw.id as number) as {id:number}[]).map(r=>r.id);assertPartValues(part.link,part.table,ids,calculated.row,cols,context,options.email);}catch{invalid++;record('Related_'+part.table,'related','รายการลูก · '+part.table+' · '+part.link.label);break;}}
   }catch{
    invalid++;
    if(options.collectIssues){
     // Strict calculation may throw before returning its error map. Diagnose only
     // that already-failed row; tolerant evaluation never decides pass/fail.
     try{const diagnostic=calculateRow(cols,raw,false,options.now,true,options.email,context),column=Object.keys(diagnostic.errors)[0];record(column||null,column?'calculation':'unknown');}catch{record(null,'unknown');}
    }
   }
   if(Date.now()>options.deadline)throw Error('หมดเวลาตรวจสูตร ยกเลิกการเผยแพร่');
  }
 }
 options.checkpoint?.(checked);return {checked,invalid,...(options.collectIssues?{issues:[...issues.values()],omittedIssueRows}:{})};
}

export type RehearsalResult={id:string;workspaceId:string;appId:string;status:'passed'|'failed'|'blocked';createdAt:number;expiresAt:number;durationMs:number;planHash:string;dataHash?:string;tables:{table:string;before:number;after:number;checked?:number}[];checks:{code:string;passed:boolean;count?:number}[];seedData?:SeedSummary[];rowIssues?:ReleaseRowIssue[];omittedIssueRows?:number;reasons:string[];publishAllowed:false;coverage?:{mode:"sample"|"full";checked:number;total:number;perTableLimit?:number;foreignKeysChecked:boolean}};
export class ReleaseRemovalBlockedError extends Error {}

export function rehearsalEligibility(plan:Pick<ReleasePlan,'appId'|'operations'|'conflicts'|'summary'>&Partial<Pick<ReleasePlan,'blockers'>>,live:ReleaseCatalog,next:ReleaseCatalog){
 const reasons:string[]=[];
 if(plan.summary.liveChanged||plan.conflicts.length||plan.blockers?.some(b=>['LIVE_CHANGED','CONFLICT'].includes(b.code)))reasons.push('การตั้งค่าจริงเปลี่ยนหรือมีข้อขัดแย้ง กรุณาตรวจการอัปเดตฐานตั้งต้น');
 const created=new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table));
 for(const op of plan.operations){
  if(op.category!=='schema')continue;
  if(op.kind==='delete_table'&&next._tables.some(t=>t.name===op.table)){reasons.push('ตารางที่จะลบยังอยู่ในฉบับร่าง');continue;}
  const table=(op.kind==='delete_table'?live:next)._tables.find(t=>t.name===op.table);
  if(op.kind==='delete_column'&&!next._tables.some(t=>t.name===op.table)&&plan.operations.some(t=>t.kind==='delete_table'&&t.table===op.table))continue;
  if(!table||table.owner_app_id!==plan.appId||table.source_kind!=='INTERNAL_DATABASE'){reasons.push('ซ้อมโครงสร้างได้เฉพาะตารางภายในที่แอปนี้เป็นเจ้าของ');continue;}
  if(!['create_table','create_column','delete_table'].includes(op.kind)&&!preservingColumnTypeChange(op,live,next)&&!releaseColumnRename(op,live,next)&&!releaseColumnRemoval(op,live,next)&&!releaseValueRewrite(op,live,next)){reasons.push(op.label+' · '+(op.fields?.includes('ref_table')?'การเปลี่ยนตารางอ้างอิงต้องตรวจและย้ายความสัมพันธ์แยกเมื่อมี Ref หรือ List ที่เก็บรหัสจริง หรือเมื่อปลายทางอยู่นอกแอป':'ยังไม่รองรับการลบ เปลี่ยนชื่อ หรือเปลี่ยนชนิดที่ต้องแปลงค่าข้อมูล'));continue;}
  if(op.kind==='create_column'&&!created.has(op.table)){
   const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
   if(!c||!c.is_virtual&&(c.is_key||c.is_unique||c.auto_number_json&&c.auto_number_json!=='null'))reasons.push('คอลัมน์จริงที่เพิ่มในตารางเดิมต้องไม่มี Key/ห้ามซ้ำ/เลขรัน');
  }
 }
 // Existing shared overlays are app-local configuration; physical shared changes stay denied.
 for(const op of plan.operations.filter(o=>o.category==='schema'&&o.table))if(live._tables.some(t=>t.name===op.table&&t.owner_app_id!==plan.appId))reasons.push('ยังไม่ซ้อมโครงสร้างของตารางร่วม');
 return [...new Set(reasons)];
}
export function dataFingerprint(database:Database.Database,names:string[],limit=2000,deadline=Date.now()+15000,projections?:Record<string,string[]>,checkpoint?:(processed:number)=>void,samplePerTable?:number,renames:Record<string,Record<string,string|null>>=Object.create(null)){
 const digest=createHash('sha256'),tables:{table:string;rows:number}[]=[];let total=0;
 for(const table of [...new Set(names)].sort()){
  assertIdentifier(table);digest.update(JSON.stringify(table));let rows=0;
  const columns=projections?.[table];if(columns)for(const name of columns)if(name!=='id')assertIdentifier(name);
  const count=samplePerTable===undefined?undefined:Number((database.prepare('SELECT COUNT(*) n FROM "t_'+table+'"').get() as {n:number}).n);
  if(count!==undefined)digest.update(JSON.stringify({count}));
  const query=rehearsalRows(table,samplePerTable===undefined?undefined:Math.min(samplePerTable,Math.max(0,limit-total)),columns?columns.map(c=>{const mapped=renames[table]?.[c];if(mapped===null)return 'NULL AS "'+c+'"';const source=mapped??c;if(source!==c)assertIdentifier(source);return '"'+source+'" AS "'+c+'"';}).join(','):'*');
  for(const row of database.prepare(query.sql).safeIntegers().iterate(...query.args)){
   if(++total%250===0)checkpoint?.(total);if(total>limit||Date.now()>deadline)throw Error('ข้อมูลเกินขีดจำกัดการซ้อมรุ่นแรก');
   digest.update(JSON.stringify(row,(_key,value)=>typeof value==='bigint'?{sqliteInteger:value.toString()}:value));rows++;
  }
  tables.push({table,rows:count??rows});
 }
 checkpoint?.(total);return {hash:digest.digest('hex'),tables};
}
/** Only a verified development copy can reach DDL. No SQL or row values come from the client. */
export function withReleaseSchemaForeignKeys<T>(database:Database.Database,run:()=>T):T {
 const enabled=database.pragma('foreign_keys',{simple:true});
 if(database.inTransaction)throw Error('Schema transaction already active');
 // SQLite rebuilds drop the source table. Suppress FK delete actions until the transaction validates the final graph.
 if(enabled)database.pragma('foreign_keys=OFF');
 try{return run();}finally{if(enabled)database.pragma('foreign_keys=ON');}
}
export function applyRehearsalSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void,seed?:ReleaseSeedData){
 const context=currentDevelopment();
 if(!context||database.name!==context.databaseFile)throw Error('การซ้อมต้องใช้ฐานข้อมูลสำเนาที่ตรวจสอบแล้ว');
 verifyDevelopment(database,context.id,context.sourceAppId);
 if(context.sourceAppId!==plan.appId)throw Error('แอปของแผนซ้อมไม่ตรงกัน');
 return withReleaseSchemaForeignKeys(database,()=>applyAdditiveSchema(database,plan,live,desired,applyConfiguration,seed,true));
}
export function applyPublicationSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void,seed?:ReleaseSeedData,allowPopulatedRemoval=false){
 if(!database.inTransaction||currentDevelopment())throw Error('การเผยแพร่ต้องอยู่ในธุรกรรมที่ยืนยันแล้ว');
 return applyAdditiveSchema(database,plan,live,desired,applyConfiguration,seed,allowPopulatedRemoval);
}
function applyAdditiveSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void,seed?:ReleaseSeedData,allowPopulatedRemoval=false){
 const reasons=rehearsalEligibility(plan,live,desired);if(reasons.length)throw Error(reasons.join(' · '));
 const tableNames=Object.entries(currentApplication()?.datasets||{}).filter(([,r])=>r.read).map(([name])=>name);
 const next=mergeReleaseCatalogScope(plan.appId,live,desired,tableNames),created=new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table!));
 const insert=(name:string,row:Record<string,unknown>)=>{const keys=Object.keys(row);for(const key of keys)if(!/^[a-z][a-z0-9_]*$/.test(key))throw Error('ชื่อคุณสมบัติไม่ถูกต้อง');return database.prepare('INSERT INTO '+name+'('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));};
 database.transaction(()=>{
  assertPartSchema(Object.fromEntries(next._tables.map(t=>[String(t.name),next._columns.filter(c=>c.table_name===t.name) as unknown as Column[]])));
  // Reserve all table metadata first so mutually referencing new tables can be checked together.
  for(const name of created){assertIdentifier(name);insert('_tables',next._tables.find(t=>t.name===name)!);}
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&created.has(o.table!))){
   const row=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;const {id,...values}=row;
   row.id=Number(insert('_columns',values).lastInsertRowid);
  }
  for(const name of created){const columns=next._columns.filter(c=>c.table_name===name&&!c.is_virtual);database.exec('CREATE TABLE "t_'+name+'"(id INTEGER PRIMARY KEY AUTOINCREMENT'+(columns.length?',':'')+columns.map(c=>columnDefinition(c as unknown as Column)).join(',')+')');}
  for(const name of created){syncKeyIndex(database,name);installRealtimeTriggers(database,name);}
  if(seed){database.pragma('defer_foreign_keys=ON');importReleaseSeedData(database,seed,plan);}
  for(const op of plan.operations.filter(o=>o.kind==='alter_column')){
   const rename=releaseColumnRename(op,live,next);
   if(rename){
    assertIdentifier(rename.table);assertIdentifier(rename.before);assertIdentifier(rename.after);
    if(!rename.virtual)database.exec('ALTER TABLE "t_'+rename.table+'" RENAME COLUMN "'+rename.before+'" TO "'+rename.after+'"');
    if(database.prepare('UPDATE _columns SET name=? WHERE id=? AND table_name=? AND name=?').run(rename.after,rename.id,rename.table,rename.before).changes!==1)throw Error('คอลัมน์เปลี่ยนหลังตรวจ');
    continue;
   }
   const rewrite=releaseValueRewrite(op,live,next);
   if(rewrite){
    const table=op.table!,name=op.name;
    assertIdentifier(table);assertIdentifier(name);
    const physical='t_'+table;
    const trusted=new Map([...realtimeTriggerDefinitions(table),...releaseRevisionTriggers(physical)].map(t=>[t.name,t.sql]));
    const triggers=database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=?").all(physical) as {name:string;sql:string}[];
    if(triggers.some(t=>trusted.get(t.name)!==t.sql))throw new ReleaseRemovalBlockedError(op.label+' · มี Trigger ภายนอกระบบ กรุณาตรวจสอบก่อนแปลงข้อมูล');
    for(const rules of ['_role_row_rules','_application_role_rows']){
     if(database.prepare('SELECT 1 FROM '+rules+' WHERE table_name=? LIMIT 1').get(table))throw new ReleaseRemovalBlockedError(op.label+' · ตารางมีเงื่อนไขสิทธิ์ระดับแถว กรุณาตรวจสอบก่อนแปลงข้อมูล');
    }
    const source=readColumns(database,table).find(c=>c.name===name)!;
    const target={...source,...rewrite.after} as Column;
    const rebuild=SQLTYPE[source.type]!==SQLTYPE[target.type]||(source.type==='ref'?source.ref_table:null)!==(target.type==='ref'?target.ref_table:null);
    const refIntent=plan.refConversions?.find(item=>item.column_id===rewrite.after.id&&item.target===target.ref_table);
    if(target.type==='ref'&&!refIntent&&database.prepare('SELECT 1 FROM "'+physical+'" WHERE "'+name+'" IS NOT NULL LIMIT 1').get())throw new ReleaseRemovalBlockedError(op.label+' · ไม่พบวิธีจับคู่ Ref กรุณาตรวจและยืนยันการแปลงในฉบับร่างใหม่');
    const resolve=referenceResolver(database,target,refIntent?.match??'id');
    const checkUsers=createUserFieldValidator(database);
    const indexed=!!source.is_key||!!source.is_unique;
    if(rebuild||indexed)prepareConversion(database,table,{column:name,mode:'replace',target});
    if(indexed&&!rebuild){
     const index=source.is_key?'_key_'+table:'_unique_'+table+'_'+name;
     database.exec('DROP INDEX IF EXISTS "'+index+'"');
    }
    const staged:{id:bigint;value:unknown}[]=[];
    const query=database.prepare('SELECT id,"'+name+'" AS value FROM "'+physical+'" WHERE id>? ORDER BY id LIMIT 500').safeIntegers();
    const save=database.prepare('UPDATE "'+physical+'" SET "'+name+'"=? WHERE id=?');
    let last=0n;
    for(;;){
     const rows=query.all(last) as {id:bigint;value:unknown}[];
     if(!rows.length)break;
     for(const row of rows){
      let value:unknown;
      try{
       const raw=typeof row.value==='bigint'?Number(row.value):row.value;
       if(typeof row.value==='bigint'&&!Number.isSafeInteger(raw))throw Error('Integer out of range');
       value=convertValue(source,target,raw,resolve);
       if(target.is_key&&(value==null||typeof value==='string'&&!value.trim()))throw Error('Empty key');
       checkUsers([target],{[name]:value});
       if(value&&target.type==='file'&&!database.prepare('SELECT 1 FROM _files WHERE id=?').get(String(value).slice(11)))throw Error('Invalid file reference');
       if(value&&['image','signature'].includes(target.type)&&!(target.type==='image'&&isRemoteImageSource(value))&&!database.prepare('SELECT 1 FROM _images WHERE id=?').get(String(value).slice(12)))throw Error('Invalid image reference');
       if(target.type==='list'&&target.ref_table&&database.prepare('SELECT 1 FROM json_each(?) j WHERE NOT EXISTS (SELECT 1 FROM "t_'+target.ref_table+'" p WHERE CAST(p.id AS TEXT)=CAST(j.value AS TEXT)) LIMIT 1').get(JSON.stringify(value)))throw Error('Invalid List reference');
       if(['list','enumlist'].includes(target.type))value=JSON.stringify(value);
      }
      catch{throw new ReleaseRemovalBlockedError(op.label+' · แถว '+row.id+' · แปลงค่าตามชนิดที่กำหนดไม่ได้');}
      if(rebuild)staged.push({id:row.id,value});
      else if(value!==row.value)save.run(value,row.id);
      last=row.id;
     }
    }
    if(database.prepare('UPDATE _columns SET type=?,ref_table=? WHERE id=? AND table_name=? AND name=? AND type=?').run(target.type,target.ref_table??null,rewrite.after.id,table,name,source.type).changes!==1)throw Error(' · คอลัมน์เปลี่ยนหลังการตรวจ กรุณาตรวจใหม่');
    if(rebuild){
     rebuildTable(database,table,!indexed);
     const write=database.prepare('UPDATE "'+physical+'" SET "'+name+'"=? WHERE id=?');
     for(const row of staged)write.run(row.value,row.id);
    }
    if(indexed){
     try{syncKeyIndex(database,table);}catch{throw new ReleaseRemovalBlockedError(op.label+' · Key / Unique validation failed');}
    }
    continue;
   }
   if(!preservingColumnTypeChange(op,live,next))throw Error('การเปลี่ยนชนิดคอลัมน์ไม่คงค่าข้อมูลเดิม');
   const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!,old=live._columns.find(previous=>previous.table_name===op.table&&previous.id===c.id)!;
   assertIdentifier(op.table);assertIdentifier(op.name);
   const physical=(database.pragma('table_info("t_'+op.table+'")') as {name:string;type:string}[]).find(p=>p.name===op.name);
   if(!old.is_virtual&&physical?.type.toUpperCase()!==SQLTYPE[String(old.type)])throw Error('โครงสร้างจริงไม่ตรงกับชนิดคอลัมน์ที่ตรวจไว้');
   if(database.prepare('UPDATE _columns SET type=?,ref_table=? WHERE id=? AND table_name=? AND name=? AND type=?').run(c.type,c.ref_table??null,c.id,op.table,op.name,old.type).changes!==1)throw Error('คอลัมน์เปลี่ยนหลังตรวจ ยกเลิกการเผยแพร่');
  }
  for(const operation of plan.operations.filter(op=>op.kind==='delete_column'&&next._tables.some(t=>t.name===op.table))){
   const removal=releaseColumnRemoval(operation,live,next);
   if(!removal)throw Error('ไม่สามารถลบคอลัมน์นี้ผ่านการเผยแพร่');
   assertIdentifier(removal.table);assertIdentifier(removal.name);
   if(!removal.virtual){
    const table='"t_'+removal.table+'"',column='"'+removal.name+'"';
    if(!allowPopulatedRemoval&&database.prepare('SELECT 1 FROM '+table+' WHERE '+column+' IS NOT NULL LIMIT 1').get())throw new ReleaseRemovalBlockedError(operation.label+' · พบข้อมูลในคอลัมน์ที่จะลบ กรุณาตรวจข้อมูลจริงก่อนซ้อมใหม่');
    database.exec('ALTER TABLE '+table+' DROP COLUMN '+column);
   }
   if(database.prepare('DELETE FROM _columns WHERE id=? AND table_name=? AND name=?').run(removal.id,removal.table,removal.name).changes!==1)throw Error('คอลัมน์เปลี่ยนหลังตรวจ');
  }
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&!created.has(o.table!))){
   const row=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;const {id,...values}=row;
   row.id=Number(insert('_columns',values).lastInsertRowid);
  }
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&!created.has(o.table!))){const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;assertIdentifier(op.table);if(!c.is_virtual)database.exec('ALTER TABLE "t_'+op.table+'" ADD COLUMN '+columnDefinition(c as unknown as Column));}
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&!created.has(o.table!))){const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;if(c.type==='ref'&&!c.is_virtual)database.exec('CREATE INDEX IF NOT EXISTS "_ref_'+op.table+'_'+c.name+'" ON "t_'+op.table+'"("'+c.name+'")');}
  for(const operation of plan.operations.filter(op=>op.kind==='delete_table')){
   const name=operation.table!;
   assertIdentifier(name);
   const physical='t_'+name;
   if(next._tables.some(table=>table.name===name))throw new ReleaseRemovalBlockedError(operation.label+' · ตารางยังอยู่ในแผนฉบับร่าง');
   if(!allowPopulatedRemoval&&database.prepare('SELECT 1 FROM "'+physical+'" LIMIT 1').get())throw new ReleaseRemovalBlockedError(operation.label+' · ตารางที่จะลบมีข้อมูลจริง');
   if(database.prepare('SELECT 1 FROM _columns WHERE ref_table=? AND table_name<>? LIMIT 1').get(name,name)||
      database.prepare("SELECT 1 FROM sqlite_schema s JOIN pragma_foreign_key_list(s.name) f WHERE s.type='table' AND s.name<>? AND f.[table]=? LIMIT 1").get(physical,physical)||
      database.prepare("SELECT 1 FROM sqlite_schema WHERE type IN ('view','trigger') AND tbl_name<>? AND instr(lower(sql),?)>0 LIMIT 1").get(physical,physical)){
    throw new ReleaseRemovalBlockedError(operation.label+' · ยังมีตารางหรือ SQL อ้างอิงอยู่ กรุณาตรวจการเชื่อมโยงก่อน');
   }
   database.exec('DROP TABLE "'+physical+'"');
   database.prepare('DROP TRIGGER IF EXISTS "_rt_config_'+name+'"').run();
   database.prepare('DELETE FROM _columns WHERE table_name=?').run(name);
   database.prepare('DELETE FROM _realtime_versions WHERE table_name=?').run(name);
   database.prepare('DELETE FROM _tables WHERE name=?').run(name);
  }
  applyConfiguration(next);
  if((database.pragma('foreign_key_check') as unknown[]).length)throw Error('ข้อมูลตารางใหม่อ้างอิงไม่ครบ ยกเลิกการเผยแพร่');
 })();
}
