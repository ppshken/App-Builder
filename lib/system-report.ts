import type Database from 'better-sqlite3';
import {totalmem,freemem,uptime,platform,arch} from 'node:os';
import {statSync} from 'node:fs';
import {platformDatabase} from './db';
import {applicationTable,APPLICATION_CONFIG_TABLES} from './application-context';
import {systemTraffic} from './system-metrics';
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
type Size={data_bytes:number|null;index_bytes:number|null;total_bytes:number|null};
export type ReportTable=Size&{name:string;label:string;owner_app_id:string;app_ids:string[];rows:number|null;collations:string[];error?:string};
export type ReportApp=Size&{id:string;label:string;table_count:number;owned_tables:number;shared_tables:number;rows:number|null;config_bytes:number|null;collations:string[]};
const cache=new WeakMap<Database.Database,{at:number;value:ReturnType<typeof inspectSystemDatabase>}>();
const sum=(values:(number|null)[])=>values.some(v=>v===null)?null:values.reduce<number>((a,b)=>a+(b||0),0);
export function inspectSystemDatabase(database:Database.Database){return database.transaction(()=>inspectDatabaseSnapshot(database))();}
function inspectDatabaseSnapshot(database:Database.Database){
 const start=performance.now(),warnings:string[]=[],checked_at=Date.now();
 const schema=database.prepare("SELECT name,tbl_name,type,sql FROM sqlite_schema WHERE type IN ('table','index')").all() as {name:string;tbl_name:string;type:string;sql:string|null}[];
 let sizes:Map<string,number>|null=null;try{sizes=new Map((database.prepare('SELECT name,pgsize FROM dbstat WHERE aggregate=TRUE').all() as {name:string;pgsize:number}[]).map(s=>[s.name,s.pgsize]));}catch{warnings.push('SQLite ชุดนี้ไม่รองรับ dbstat จึงไม่สามารถแยกขนาดตารางและดัชนีได้');}
 const sizeOf=(name:string):Size=>{const data_bytes=sizes?.get(name)??null,index_bytes=sizes?schema.filter(s=>s.type==='index'&&s.tbl_name===name).reduce((n,s)=>n+(sizes!.get(s.name)||0),0):null;return {data_bytes,index_bytes,total_bytes:data_bytes===null||index_bytes===null?null:data_bytes+index_bytes};};
 const apps=database.prepare('SELECT id,label FROM _applications ORDER BY created_at,id').all() as {id:string;label:string}[];
 const links=database.prepare('SELECT app_id,table_name FROM _application_datasets WHERE can_read=1').all() as {app_id:string;table_name:string}[];
 const tables=(database.prepare('SELECT name,label,owner_app_id FROM _tables ORDER BY label,name').all() as {name:string;label:string;owner_app_id:string}[]).map(t=>{const physical='t_'+t.name;let rows:number|null=null,error:string|undefined;try{rows=(database.prepare('SELECT COUNT(*) n FROM '+quote(physical)).get() as {n:number}).n;}catch{error='ไม่สามารถอ่านจำนวนแถวได้';warnings.push(t.name+': '+error);}
 const collations=new Set<string>(['BINARY']);const sql=schema.find(s=>s.name===physical)?.sql||'';for(const match of sql.matchAll(/\bCOLLATE\s+["\x60\[]?([a-z_][a-z0-9_]*)/gi))collations.add(match[1].toUpperCase());
 for(const index of schema.filter(s=>s.type==='index'&&s.tbl_name===physical))try{for(const c of database.pragma('index_xinfo('+quote(index.name)+')') as {coll:string|null;key:number}[])if(c.key&&c.coll)collations.add(c.coll.toUpperCase());}catch{warnings.push(t.name+': ไม่สามารถอ่าน Collation ของดัชนี');}
 return {...t,...sizeOf(physical),rows,collations:[...collations],app_ids:[...new Set([t.owner_app_id,...links.filter(l=>l.table_name===t.name).map(l=>l.app_id)])],...(error?{error}:{})} satisfies ReportTable;
 });
 const appReports=apps.map(app=>{const connected=tables.filter(t=>t.app_ids.includes(app.id));const label=(database.prepare('SELECT name FROM '+quote(applicationTable(app.id,'_app_settings'))+' WHERE id=1').get() as {name:string}|undefined)?.name||app.label;return {...app,label,table_count:connected.length,collations:[...new Set(connected.flatMap(t=>t.collations))],owned_tables:connected.filter(t=>t.owner_app_id===app.id).length,shared_tables:connected.filter(t=>t.owner_app_id!==app.id).length,rows:sum(connected.map(t=>t.rows)),data_bytes:sum(connected.map(t=>t.data_bytes)),index_bytes:sum(connected.map(t=>t.index_bytes)),total_bytes:sum(connected.map(t=>t.total_bytes)),config_bytes:sum(APPLICATION_CONFIG_TABLES.map(t=>sizeOf(applicationTable(app.id,t)).total_bytes))} satisfies ReportApp;});
 const businessObjects=new Set(tables.map(t=>'t_'+t.name));for(const item of schema)if(item.type==='index'&&businessObjects.has(item.tbl_name))businessObjects.add(item.name);
 const page_size=database.pragma('page_size',{simple:true}) as number,page_count=database.pragma('page_count',{simple:true}) as number,free_pages=database.pragma('freelist_count',{simple:true}) as number;
 return {checked_at,duration_ms:performance.now()-start,warnings,apps:appReports,tables,database:{engine:'SQLite',version:(database.prepare('SELECT sqlite_version() version').get() as {version:string}).version,database_count:1,encoding:database.pragma('encoding',{simple:true}) as string,journal_mode:database.pragma('journal_mode',{simple:true}) as string,page_size,page_count,allocated_bytes:page_size*page_count,free_bytes:page_size*free_pages,table_count:tables.length,rows:sum(tables.map(t=>t.rows)),data_bytes:sum(tables.map(t=>t.data_bytes)),index_bytes:sum(tables.map(t=>t.index_bytes)),business_bytes:sum(tables.map(t=>t.total_bytes)),other_bytes:sizes?[...sizes.entries()].filter(([name])=>!businessObjects.has(name)).reduce((n,[,bytes])=>n+bytes,0):null,size_available:!!sizes}};
}
export type SystemInventory=ReturnType<typeof inspectSystemDatabase>;
export function systemReport(refresh=false){const db=platformDatabase(),now=Date.now(),prior=cache.get(db);let inventory=prior?.value;if(!prior||now-prior.at>=60000||(refresh&&now-prior.at>=5000)){inventory=inspectSystemDatabase(db);cache.set(db,{at:now,value:inventory});}
 const main=(db.pragma('database_list') as {name:string;file:string}[]).find(d=>d.name==='main')?.file;const fileBytes=(suffix:string)=>{if(!main)return 0;try{return statSync(main+suffix).size;}catch{return 0;}};
 const memory=process.memoryUsage(),total=totalmem(),free=freemem(),started=performance.now();db.prepare('SELECT 1').get();
 return {checked_at:now,inventory:inventory!,server:{status:'online' as const,database_status:'online' as const,database_latency_ms:performance.now()-started,process_uptime_seconds:process.uptime(),host_uptime_seconds:uptime(),platform:platform(),arch:arch(),node_version:process.version,memory:{host_total_bytes:total,host_used_bytes:Math.max(0,total-free),host_free_bytes:free,process_rss_bytes:memory.rss,heap_used_bytes:memory.heapUsed,heap_total_bytes:memory.heapTotal},connections:{current_process_main_open:db.open?1:0,server_active_connections:null},files:{main_bytes:fileBytes(''),wal_bytes:fileBytes('-wal'),shm_bytes:fileBytes('-shm')}},traffic:systemTraffic()};
}
export type SystemReport=ReturnType<typeof systemReport>;
