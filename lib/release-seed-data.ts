import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {assertIdentifier} from './columns';
import type {ReleaseCatalog,ReleasePlan} from './release-plan';

type Row=Record<string,unknown>;
export type SeedSummary={table:string;label:string;total:number;included:number;skipped:number;reasons:{code:string;count:number}[]};
export type ReleaseSeedData={hash:string;tables:SeedSummary[];records:Map<string,Row[]>};
const serialize=(value:unknown)=>JSON.stringify(value,(_key,value)=>typeof value==='bigint'?{sqliteInteger:value.toString()}:value);
const present=(v:unknown)=>v!==null&&v!==undefined&&v!=='';
/** Reads only newly-created owned tables. Existing table rows can never enter this payload. */
export function releaseSeedData(workspace:Database.Database,plan:ReleasePlan,live:ReleaseCatalog,next:ReleaseCatalog,options:{maxRows?:number;maxBytes?:number;deadline?:number}={}):ReleaseSeedData{
 const maxRows=options.maxRows??100000,maxBytes=options.maxBytes??32*1024**2,deadline=options.deadline??Date.now()+10000;
 const created=[...new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table!))].sort();
 const names=new Set(created),nodes=new Map<string,{table:string;row:Row;reason?:string;dependents:string[]}>(),records=new Map<string,Row[]>(),tables:SeedSummary[]=[];
 const byTable=new Map(created.map(name=>[name,next._columns.filter(c=>c.table_name===name&&!c.is_virtual)]));
 let count=0,bytes=0;const digest=createHash('sha256');digest.update('independent-new-rows-v1');
 const key=(table:string,id:unknown)=>JSON.stringify([table,String(id)]);
 const check=()=>{if(count>maxRows||bytes>maxBytes||Date.now()>deadline)throw Error('ข้อมูลตารางใหม่เกินขีดจำกัด 100,000 แถว / 32 MB หรือเวลาตรวจ กรุณาแยกการนำเข้าข้อมูล');};
 for(const name of created){
  assertIdentifier(name);const table=next._tables.find(t=>t.name===name);
  if(!table||table.owner_app_id!==plan.appId||table.source_kind!=='INTERNAL_DATABASE'||live._tables.some(t=>t.name===name))throw Error('นำข้อมูลได้เฉพาะตารางภายในที่สร้างใหม่ของแอปนี้');
  const cols=byTable.get(name)!.filter(c=>c.name!=='id');for(const c of cols)assertIdentifier(c.name);
  const fields=['id',...cols.map(c=>String(c.name))],rows:Row[]=[];
  digest.update(serialize([name,fields]));
  for(const raw of workspace.prepare('SELECT '+fields.map(f=>'"'+f+'"').join(',')+' FROM "t_'+name+'" ORDER BY id').safeIntegers().iterate() as Iterable<Row>){
   count++;const encoded=serialize(raw);bytes+=Buffer.byteLength(encoded);check();digest.update(encoded);
   if(!present(raw.id))throw Error('ข้อมูลตารางใหม่ไม่มีรหัสแถว');
   const row={...raw};rows.push(row);nodes.set(key(name,row.id),{table:name,row,dependents:[]});
  }
  records.set(name,rows);tables.push({table:name,label:String(table.label||name),total:rows.length,included:0,skipped:0,reasons:[]});
 }
 const queue:string[]=[];
 for(const [nodeKey,node] of nodes){
  check();const cols=byTable.get(node.table)!;
  for(const c of cols){
   const value=node.row[String(c.name)];if(!present(value))continue;
   // Uploaded development media need a separate file migration; never publish a broken path.
   if(['image','file','signature'].includes(String(c.type))&&!/^https?:\/\//i.test(String(value))){node.reason??='DEVELOPMENT_FILE';continue;}
   if(c.type==='user'){node.reason??='EXISTING_DATA_REFERENCE';continue;}
   if(!c.ref_table)continue;
   let values:unknown[]=[value];
   if(['list','enumlist'].includes(String(c.type))){try{const parsed=typeof value==='string'?JSON.parse(value):value;if(!Array.isArray(parsed))throw Error();values=parsed;}catch{node.reason??='INVALID_REFERENCE';continue;}}
   for(const id of values.filter(present)){
    if(!names.has(String(c.ref_table))){node.reason??='EXISTING_DATA_REFERENCE';continue;}
    const target=nodes.get(key(String(c.ref_table),id));if(!target){node.reason??='MISSING_NEW_REFERENCE';continue;}
    target.dependents.push(nodeKey);
   }
  }
  if(node.reason)queue.push(nodeKey);
 }
 // Propagate exclusions in O(rows + edges), including dependency chains and cycles.
 for(let i=0;i<queue.length;i++){check();for(const dependent of nodes.get(queue[i])!.dependents){const n=nodes.get(dependent)!;if(!n.reason){n.reason='EXCLUDED_NEW_REFERENCE';queue.push(dependent);}}}
 for(const summary of tables){const reasons=new Map<string,number>();const eligible=records.get(summary.table)!.filter(row=>{const reason=nodes.get(key(summary.table,row.id))!.reason;if(reason){reasons.set(reason,(reasons.get(reason)||0)+1);return false;}return true;});records.set(summary.table,eligible);summary.included=eligible.length;summary.skipped=summary.total-eligible.length;summary.reasons=[...reasons].sort(([a],[b])=>a.localeCompare(b)).map(([code,count])=>({code,count}));}
 return {hash:digest.digest('hex'),tables,records};
}

/** Must share the schema publication transaction. Does not update existing tables or run Actions. */
export function importReleaseSeedData(database:Database.Database,seed:ReleaseSeedData,plan:ReleasePlan){
 if(!database.inTransaction)throw Error('นำข้อมูลใหม่ได้เฉพาะในธุรกรรมเผยแพร่');
 const allowed=new Set(plan.operations.filter(o=>o.kind==='create_table').map(o=>o.table));
 for(const [name,rows] of seed.records){
  assertIdentifier(name);if(!allowed.has(name))throw Error('ห้ามนำข้อมูลไปยังตารางเดิม');
  if(Number((database.prepare('SELECT COUNT(*) n FROM "t_'+name+'"').get() as {n:number}).n)!==0)throw Error('ตารางปลายทางต้องเป็นตารางใหม่ที่ว่าง');
  if(!rows.length)continue;const fields=Object.keys(rows[0]);for(const field of fields)if(field!=='id')assertIdentifier(field);
  const insert=database.prepare('INSERT INTO "t_'+name+'"('+fields.map(f=>'"'+f+'"').join(',')+') VALUES('+fields.map(()=>'?').join(',')+')');
  for(const row of rows)insert.run(...fields.map(f=>row[f]));
 }
}
