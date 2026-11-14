import {createHash} from 'node:crypto';
import type Database from 'better-sqlite3';
import type {ReleaseCatalog,ReleasePlan} from './release-plan';
import {assertIdentifier,calculateRow,validateRow,formState,type Column} from './columns';
import {isBlank} from './expression';
import {columnDefinition,syncKeyIndex,readColumns} from './schema';
import {expressionContext} from './expression-context';
import {installRealtimeTriggers} from './realtime-schema';
import {currentDevelopment} from './development-context';
import {verifyDevelopment} from './development-workspace';
// Bump when the schema executor or its safety contract changes; old rehearsal proofs must expire.
export const RELEASE_EXECUTOR_VERSION='validated-publication-2026-11-15-v4';
export const REHEARSAL_SAMPLE_ROWS=100;
export const REHEARSAL_SAMPLE_LIMIT=1000;
// Deterministic head/tail samples; keep the complete database for Ref/formula accuracy.
export function rehearsalRows(table:string,limit?:number,fields='*'){
 assertIdentifier(table);const from=' FROM "t_'+table+'"';if(limit===undefined)return {sql:'SELECT '+fields+from+' ORDER BY id',args:[] as number[]};
 if(!Number.isSafeInteger(limit)||limit<0)throw Error('จำนวนตัวอย่างไม่ถูกต้อง');const head=Math.ceil(limit/2),tail=Math.floor(limit/2);return {sql:'SELECT '+fields+from+' WHERE id IN (SELECT id FROM (SELECT id'+from+' ORDER BY id LIMIT ?) UNION SELECT id FROM (SELECT id'+from+' ORDER BY id DESC LIMIT ?)) ORDER BY id',args:[head,tail]};
}
export const PUBLICATION_VALIDATION_LIMIT=2000;
/** Evaluates existing formulas without persisting calculated values or exposing row values. */
export type ReleaseRowIssue={table:string;tableLabel:string;column:string|null;columnLabel:string;kind:'calculation'|'required'|'validation'|'unknown';count:number};
export function validateReleaseRows(database:Database.Database,names:string[],options:{limit:number;deadline:number;email:string;now:Date;checkpoint?:(checked:number)=>void;collectIssues?:boolean;samplePerTable?:number}){
 let checked=0,invalid=0,omittedIssueRows=0;const issues=new Map<string,ReleaseRowIssue>();
 for(const table of [...new Set(names)].sort()){
  assertIdentifier(table);const cols=readColumns(database,table);
  const tableLabel=options.collectIssues?String((database.prepare('SELECT label FROM _tables WHERE name=?').get(table) as {label:string}|undefined)?.label||table):table;
  const record=(column:string|null,kind:ReleaseRowIssue['kind'])=>{if(!options.collectIssues)return;const key=JSON.stringify([table,column,kind]),existing=issues.get(key);if(existing){existing.count++;return;}if(issues.size>=200){omittedIssueRows++;return;}issues.set(key,{table,tableLabel,column,columnLabel:cols.find(c=>c.name===column)?.label||column||'ไม่สามารถระบุคอลัมน์',kind,count:1});};
  const context=expressionContext(options.now,options.email,database),query=rehearsalRows(table,options.samplePerTable===undefined?undefined:Math.min(options.samplePerTable,Math.max(0,options.limit-checked)));
  for(const raw of database.prepare(query.sql).iterate(...query.args) as Iterable<Record<string,unknown>>){
   if(++checked>options.limit||Date.now()>options.deadline)throw Error('ข้อมูลเกินขีดจำกัดการตรวจสูตร กรุณาแบ่งแผนเผยแพร่');
   if(checked%100===0)options.checkpoint?.(checked);
   try{
    const calculated=calculateRow(cols,raw,false,options.now,false,options.email,context),column=Object.keys(calculated.errors)[0];
    if(column){invalid++;record(column,'calculation');}
    else if(options.collectIssues){
     // Same first-error order as validateRow; never persist exception text or row values.
     const state=formState(cols,calculated.row,options.now,options.email,context),error=Object.keys(state.errors)[0],validation=Object.keys(state.validation)[0];
     if(error||validation){invalid++;const name=error||validation;record(name,error?'calculation':state.required[name]&&isBlank(state.row[name])?'required':'validation');}
    }else validateRow(cols,calculated.row,options.now,options.email,context);
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

export type RehearsalResult={id:string;workspaceId:string;appId:string;status:'passed'|'failed'|'blocked';createdAt:number;expiresAt:number;durationMs:number;planHash:string;dataHash?:string;tables:{table:string;before:number;after:number;checked?:number}[];checks:{code:string;passed:boolean;count?:number}[];rowIssues?:ReleaseRowIssue[];omittedIssueRows?:number;reasons:string[];publishAllowed:false;coverage?:{mode:"sample"|"full";checked:number;total:number;perTableLimit?:number;foreignKeysChecked:boolean}};
export function rehearsalEligibility(plan:Pick<ReleasePlan,'appId'|'operations'|'conflicts'|'summary'>&Partial<Pick<ReleasePlan,'blockers'>>,live:ReleaseCatalog,next:ReleaseCatalog){
 const reasons:string[]=[];
 if(plan.summary.liveChanged||plan.conflicts.length||plan.blockers?.some(b=>['LIVE_CHANGED','CONFLICT'].includes(b.code)))reasons.push('การตั้งค่าจริงเปลี่ยนหรือมีข้อขัดแย้ง กรุณาสร้างพื้นที่พัฒนาใหม่');
 const created=new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table));
 for(const op of plan.operations){
  if(op.category!=='schema')continue;
  const table=next._tables.find(t=>t.name===op.table);
  if(!table||table.owner_app_id!==plan.appId||table.source_kind!=='INTERNAL_DATABASE'){reasons.push('ซ้อมโครงสร้างได้เฉพาะตารางภายในที่แอปนี้เป็นเจ้าของ');continue;}
  if(!['create_table','create_column'].includes(op.kind)){reasons.push('รุ่นนี้ยังไม่ซ้อมการลบ เปลี่ยนชื่อ หรือเปลี่ยนชนิดโครงสร้าง');continue;}
  if(op.kind==='create_column'&&!created.has(op.table)){
   const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name);
   if(!c||!c.is_virtual&&(c.is_key||c.is_unique||c.auto_number_json&&c.auto_number_json!=='null'))reasons.push('คอลัมน์จริงที่เพิ่มในตารางเดิมต้องไม่มี Key/ห้ามซ้ำ/เลขรัน');
  }
 }
 // Existing shared overlays are app-local configuration; physical shared changes stay denied.
 for(const op of plan.operations.filter(o=>o.category==='schema'&&o.table))if(live._tables.some(t=>t.name===op.table&&t.owner_app_id!==plan.appId))reasons.push('ยังไม่ซ้อมโครงสร้างของตารางร่วม');
 return [...new Set(reasons)];
}
export function dataFingerprint(database:Database.Database,names:string[],limit=2000,deadline=Date.now()+15000,projections?:Record<string,string[]>,checkpoint?:(processed:number)=>void,samplePerTable?:number){
 const digest=createHash('sha256'),tables:{table:string;rows:number}[]=[];let total=0;
 for(const table of [...new Set(names)].sort()){
  assertIdentifier(table);digest.update(JSON.stringify(table));let rows=0;
  const columns=projections?.[table];if(columns)for(const name of columns)if(name!=='id')assertIdentifier(name);
  const count=samplePerTable===undefined?undefined:Number((database.prepare('SELECT COUNT(*) n FROM "t_'+table+'"').get() as {n:number}).n);
  if(count!==undefined)digest.update(JSON.stringify({count}));
  const query=rehearsalRows(table,samplePerTable===undefined?undefined:Math.min(samplePerTable,Math.max(0,limit-total)),columns?columns.map(c=>'"'+c+'"').join(','):'*');
  for(const row of database.prepare(query.sql).safeIntegers().iterate(...query.args)){
   if(++total%250===0)checkpoint?.(total);if(total>limit||Date.now()>deadline)throw Error('ข้อมูลเกินขีดจำกัดการซ้อมรุ่นแรก');
   digest.update(JSON.stringify(row,(_key,value)=>typeof value==='bigint'?{sqliteInteger:value.toString()}:value));rows++;
  }
  tables.push({table,rows:count??rows});
 }
 checkpoint?.(total);return {hash:digest.digest('hex'),tables};
}
/** Only a verified development copy can reach DDL. No SQL or row values come from the client. */
export function applyRehearsalSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void){
 const context=currentDevelopment();
 if(!context||database.name!==context.databaseFile)throw Error('การซ้อมต้องใช้ฐานข้อมูลสำเนาที่ตรวจสอบแล้ว');
 verifyDevelopment(database,context.id,context.sourceAppId);
 if(context.sourceAppId!==plan.appId)throw Error('แอปของแผนซ้อมไม่ตรงกัน');
 return applyAdditiveSchema(database,plan,live,desired,applyConfiguration);
}
export function applyPublicationSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void){
 if(!database.inTransaction||currentDevelopment())throw Error('การเผยแพร่ต้องอยู่ในธุรกรรมที่ยืนยันแล้ว');
 return applyAdditiveSchema(database,plan,live,desired,applyConfiguration);
}
function applyAdditiveSchema(database:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,desired:ReleaseCatalog,applyConfiguration:(catalog:ReleaseCatalog)=>void){
 const reasons=rehearsalEligibility(plan,live,desired);if(reasons.length)throw Error(reasons.join(' · '));
 const next=structuredClone(desired),created=new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table!));
 const insert=(name:string,row:Record<string,unknown>)=>{const keys=Object.keys(row);for(const key of keys)if(!/^[a-z][a-z0-9_]*$/.test(key))throw Error('ชื่อคุณสมบัติไม่ถูกต้อง');return database.prepare('INSERT INTO '+name+'('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));};
 database.transaction(()=>{
  // Reserve all table metadata first so mutually referencing new tables can be checked together.
  for(const name of created){assertIdentifier(name);insert('_tables',next._tables.find(t=>t.name===name)!);}
  for(const op of plan.operations.filter(o=>o.kind==='create_column')){
   const row=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;const {id,...values}=row;
   row.id=Number(insert('_columns',values).lastInsertRowid);
  }
  for(const name of created){const columns=next._columns.filter(c=>c.table_name===name&&!c.is_virtual);database.exec('CREATE TABLE "t_'+name+'"(id INTEGER PRIMARY KEY AUTOINCREMENT'+(columns.length?',':'')+columns.map(c=>columnDefinition(c as unknown as Column)).join(',')+')');}
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&!created.has(o.table!))){const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;assertIdentifier(op.table);if(!c.is_virtual)database.exec('ALTER TABLE "t_'+op.table+'" ADD COLUMN '+columnDefinition(c as unknown as Column));}
  for(const name of created){syncKeyIndex(database,name);installRealtimeTriggers(database,name);}
  for(const op of plan.operations.filter(o=>o.kind==='create_column'&&!created.has(o.table!))){const c=next._columns.find(c=>c.table_name===op.table&&c.name===op.name)!;if(c.type==='ref'&&!c.is_virtual)database.exec('CREATE INDEX IF NOT EXISTS "_ref_'+op.table+'_'+c.name+'" ON "t_'+op.table+'"("'+c.name+'")');}
  applyConfiguration(next);
 })();
}
