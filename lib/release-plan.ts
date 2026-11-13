import {createHash} from 'node:crypto';

/** Metadata only. This module never opens a database or executes a plan. */
export type ReleaseCatalog = Record<string, Record<string, unknown>[]>;
type Row = Record<string, unknown>;
export type ReleaseOperation = {
  id:string; category:'schema'|'configuration'|'shared'; kind:string;
  table?:string; name:string; label:string; fields:string[];
  risk:'low'|'medium'|'high'; supported:boolean; requiresDataValidation:boolean;
  dependencies:string[]; impacts:string[];
};
export type ReleasePlan = {
  version:1; mode:'read-only'; appId:string; workspaceId:string;
  fingerprints:{baseline:string;live:string;draft:string};
  operations:ReleaseOperation[];
  conflicts:{collection:string;name:string;fields:string[]}[];
  blockers:{code:string;message:string;operationId?:string}[];
  notices:string[];
  summary:{schema:number;configuration:number;shared:number;unsupported:number;conflicts:number;liveChanged:boolean};
  publishBlocked:boolean;
};
const collections=['_tables','_columns','_table_overlays','_slices','_views','_actions','_app_settings','_pdf_templates','_automations'] as const;
const structuralFields=new Set(['id','table_name','name','type','is_virtual','is_key','is_unique','ref_table']);
const order=(a:string,b:string)=>a<b?-1:a>b?1:0;
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort(order).map(k=>[k,canonical((value as Row)[k])]));
  return value;
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function normalized(row:Row,collection:string):Row {
  return Object.fromEntries(Object.entries(row).filter(([key])=>!(collection==='_automations'&&key==='next_run_at')).map(([key,value])=>{
    if(key.endsWith('_json')&&typeof value==='string'){
      try{return [key,canonical(JSON.parse(value))];}catch{/* Readiness reports invalid stored JSON separately. */}
    }
    return [key,value];
  }));
}
function identity(row:Row,collection:string):string {
  if(collection==='_columns'){
    if(typeof row.table_name!=='string'||!Number.isSafeInteger(row.id)||Number(row.id)<1)throw Error('ข้อมูลคอลัมน์ไม่มีรหัสที่ใช้จับคู่ฉบับร่างได้');
    return JSON.stringify([row.table_name,row.id]);
  }
  const key=collection==='_table_overlays'?'table_name':collection==='_app_settings'?'id':'name';
  if(row[key]===undefined||row[key]===null||row[key]==='')throw Error('ข้อมูลตั้งค่าไม่มีรหัสสำหรับเปรียบเทียบ');
  return String(row[key]);
}
function snapshot(catalog:ReleaseCatalog,tables:Set<string>,origins?:{tables:Record<string,{uid:string;sourceKey:string|null}>;columns:Record<string,{uid:string;sourceKey:string|null}>}){
  return Object.fromEntries(collections.map(collection=>{
    const entries=(catalog[collection]||[]).filter(row=>collection==='_tables'?tables.has(String(row.name)):['_columns','_table_overlays'].includes(collection)?tables.has(String(row.table_name)):true);
    const indexed=new Map<string,Row>();
    for(const row of entries){let key=identity(row,collection);const origin=collection==='_tables'?origins?.tables[String(row.name)]:collection==='_columns'?origins?.columns[String(row.table_name)+':'+row.id]:undefined;if(origin?.sourceKey===null)key='new:'+origin.uid;if(indexed.has(key))throw Error('พบรหัสซ้ำในการตั้งค่า กรุณาตรวจข้อมูลก่อนเปรียบเทียบ');indexed.set(key,normalized(row,collection));}
    return [collection,new Map([...indexed].sort(([a],[b])=>order(a,b)))];
  })) as Record<typeof collections[number],Map<string,Row>>;
}
const fingerprint=(value:ReturnType<typeof snapshot>)=>createHash('sha256').update(JSON.stringify(canonical(Object.fromEntries(collections.map(c=>[c,[...value[c]]]))))).digest('hex');
const changedFields=(a:Row|undefined,b:Row|undefined)=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(key=>!equal(a?.[key],b?.[key])).sort(order);

export function analyzeReleasePlan(baseline:ReleaseCatalog,live:ReleaseCatalog,draft:ReleaseCatalog,options:{appId:string;workspaceId:string;tableNames?:readonly string[];sharedTables?:readonly string[];legacyConflict?:boolean;origins?:{tables:Record<string,{uid:string;sourceKey:string|null}>;columns:Record<string,{uid:string;sourceKey:string|null}>}}):ReleasePlan {
  if(!options.appId||!options.workspaceId)throw Error('กรุณาระบุแอปและฉบับร่างที่ต้องการเปรียบเทียบ');
  // Ownership and explicit application grants define the scope, never display names.
  const tables=new Set(options.tableNames||[]);
  for(const catalog of [baseline,live,draft])for(const row of catalog._tables||[])if(String(row.owner_app_id||'default')===options.appId)tables.add(String(row.name));
  const shared=new Set(options.sharedTables||[]);
  for(const catalog of [baseline,live,draft])for(const row of catalog._tables||[])if(tables.has(String(row.name))&&String(row.owner_app_id||'default')!==options.appId)shared.add(String(row.name));
  const before=snapshot(baseline,tables),current=snapshot(live,tables),next=snapshot(draft,tables,options.origins);
  const hashes={baseline:fingerprint(before),live:fingerprint(current),draft:fingerprint(next)};
  const operations:ReleaseOperation[]=[],conflicts:ReleasePlan['conflicts']=[],blockers:ReleasePlan['blockers']=[];
  for(const collection of collections){
    const keys=[...new Set([...before[collection].keys(),...current[collection].keys(),...next[collection].keys()])].sort(order);
    for(const key of keys){
      const base=before[collection].get(key),actual=current[collection].get(key),desired=next[collection].get(key);
      const localFields=changedFields(base,desired),liveFields=changedFields(base,actual);
      if(localFields.length&&liveFields.length&&!equal(actual,desired)){
        const overlap=!base||!actual||!desired?[...new Set([...localFields,...liveFields])].sort(order):localFields.filter(field=>liveFields.includes(field)&&!equal(actual[field],desired[field]));
        if(overlap.length)conflicts.push({collection,name:String(desired?.name||actual?.name||key),fields:overlap});
      }
      // No automatic three-way merge in phase 1. Live-only changes still block publication.
      if(!localFields.length||equal(actual,desired))continue;
      const row=desired||base!,fields=changedFields(actual,desired),table=collection==='_tables'?String(row.name):typeof row.table_name==='string'?row.table_name:undefined;
      const structural=collection==='_tables'&&(!base||!desired||localFields.some(field=>['owner_app_id','source_kind','source_id'].includes(field)))||collection==='_columns'&&(!base||!desired||localFields.some(field=>structuralFields.has(field)));
      const category:ReleaseOperation['category']=structural?'schema':collection==='_table_overlays'?'shared':'configuration';
      const kind=collection==='_tables'&&!base?'create_table':collection==='_tables'&&!desired?'delete_table':collection==='_columns'&&!base?'create_column':collection==='_columns'&&!desired?'delete_column':structural?(collection==='_tables'?'alter_table':'alter_column'):!base?'create_configuration':!desired?'delete_configuration':'update_configuration';
      const dataValidation=structural||collection==='_columns'&&localFields.some(f=>['required','required_if','valid_if','default_expr','virtual_expr','reset_on_edit','reset_columns'].includes(f));
      const impacts:string[]=[];
      if(structural)impacts.push(['create_table','create_column'].includes(kind)?'เพิ่มโครงสร้างใหม่ ต้องซ้อมกับข้อมูลล่าสุดและยืนยันผลกระทบก่อนเผยแพร่':'เปลี่ยนโครงสร้างหรือรหัสคอลัมน์ ยังไม่รองรับการเผยแพร่การเปลี่ยนนี้');
      if(structural&&table&&shared.has(table))impacts.push('ตารางใช้ร่วมกับแอปอื่น ต้องตรวจผลกระทบทุกแอปและสิทธิ์เจ้าของก่อนเปลี่ยนโครงสร้าง');
      if(dataValidation)impacts.push('ต้องตรวจสูตรและข้อมูลจริงล่าสุดก่อนใช้ ไม่คัดลอกข้อมูลทดลองมาทับข้อมูลจริง');
      if(collection==='_table_overlays')impacts.push('เป็นการตั้งค่าตารางร่วมเฉพาะแอป ต้องตรวจโครงสร้างต้นทางและการรีเจน');
      if(collection==='_automations')impacts.push('การเผยแพร่อาจเปลี่ยนงานเบื้องหลังและผลข้างเคียงภายนอก ต้องตรวจเงื่อนไขและขั้นตอน');
      if(!base&&['_tables','_actions'].includes(collection))impacts.push('ต้องตรวจสิทธิ์ตารางหรือ Action ใหม่กับบทบาทจริง ไม่ให้สิทธิ์ทุกบทบาทอัตโนมัติ');
      if(!impacts.length)impacts.push('ตรวจหน้าจอ สูตร และรายการที่เชื่อมโยงก่อนเผยแพร่การตั้งค่า');
      const id=collection+':'+key;
      operations.push({id,category,kind,table,name:String(row.name||row.table_name||key),label:String(row.label||row.name||row.table_name||key),fields,risk:structural?(['create_table','create_column'].includes(kind)?'medium':'high'):dataValidation||['_automations','_actions','_table_overlays'].includes(collection)?'medium':'low',supported:!structural,requiresDataValidation:!!dataValidation,dependencies:[],impacts});
      if(structural)blockers.push({code:'SCHEMA_NOT_SUPPORTED',operationId:id,message:'ยังไม่รองรับการเผยแพร่โครงสร้าง กรุณาใช้แผนนี้เพื่อตรวจผลกระทบเท่านั้น'});
    }
  }
  // Conservative dependencies: all configuration waits for schema; Ref columns wait for target tables.
  const tableCreates=new Map(operations.filter(o=>o.kind==='create_table').map(o=>[o.table!,o.id]));
  const schemaIds=operations.filter(o=>o.category==='schema').map(o=>o.id);
  for(const operation of operations){
    if(operation.category!=='schema')operation.dependencies=[...schemaIds];
    else if(operation.kind!=='create_table'&&operation.table){
      const own=tableCreates.get(operation.table);if(own)operation.dependencies.push(own);
      const column=operation.id.startsWith('_columns:')?next._columns.get(operation.id.slice('_columns:'.length)):undefined;
      const target=typeof column?.ref_table==='string'?tableCreates.get(column.ref_table):undefined;if(target)operation.dependencies.push(target);
    }
    operation.dependencies=[...new Set(operation.dependencies)].filter(id=>id!==operation.id).sort(order);
  }
  const pending=new Map(operations.map(o=>[o.id,o])),sorted:ReleaseOperation[]=[],done=new Set<string>();
  while(pending.size){const available=[...pending.values()].filter(o=>o.dependencies.every(id=>done.has(id))).sort((a,b)=>order(a.id,b.id));if(!available.length)throw Error('ลำดับการเปลี่ยนแปลงพึ่งพาวนกัน กรุณาตรวจแผน');for(const operation of available){sorted.push(operation);done.add(operation.id);pending.delete(operation.id);}}
  const liveChanged=hashes.baseline!==hashes.live;
  if(liveChanged||options.legacyConflict)blockers.push({code:'LIVE_CHANGED',message:'การตั้งค่าจริงเปลี่ยนหลังสร้างฉบับร่าง รุ่นนี้ยังไม่รวมการแก้ไขอัตโนมัติ กรุณาสร้างฐานตั้งต้นใหม่'});
  if(conflicts.length)blockers.push({code:'CONFLICT',message:'พบการแก้ไขรายการเดียวกันต่างค่าระหว่างแอปจริงและฉบับร่าง'});
  return {version:1,mode:'read-only',appId:options.appId,workspaceId:options.workspaceId,fingerprints:hashes,operations:sorted,conflicts,blockers,notices:['แผนนี้อ่านเฉพาะการตั้งค่า ไม่อ่านหรือย้ายแถวข้อมูลธุรกิจ และไม่มีการรัน SQL อัปเดต','คงสมาชิก รหัสผ่าน และสิทธิ์จริงไว้ การเปรียบเทียบนี้ไม่ใช่การอนุมัติสิทธิ์ใหม่','สิ่งที่ระบุว่าเผยแพร่ได้ยังต้องผ่านการตรวจสุขภาพและเงื่อนไขของระบบเผยแพร่เดิม'],summary:{schema:operations.filter(o=>o.category==='schema').length,configuration:operations.filter(o=>o.category==='configuration').length,shared:operations.filter(o=>o.category==='shared').length,unsupported:operations.filter(o=>!o.supported).length,conflicts:conflicts.length,liveChanged},publishBlocked:!!blockers.length};
}
