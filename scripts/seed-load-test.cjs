// Explicitly opt in to the user's live database; never overwrite an existing test table.
const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const root=path.resolve(__dirname,'..'),live=process.argv.includes('--live'),arg=process.argv.indexOf('--db'),databasePath=arg>=0?path.resolve(process.argv[arg+1]):null;
if(!databasePath)throw Error('Provide --db PATH');
const allowed=live?databasePath===path.join(root,'data.db'):databasePath.startsWith(path.join(root,'.test-data')+path.sep);
if(!allowed)throw Error('Database path is outside the explicitly allowed target');
if(live&&!fs.existsSync(databasePath))throw Error('The live database must already exist');
const compiled=path.join(root,'.test-data','seed-tools');if(!fs.existsSync(path.join(compiled,'metadata.js')))throw Error('Compile lib/metadata.ts lib/schema.ts lib/audit-schema.ts lib/backups.ts into .test-data/seed-tools first');
const {withDatabase}=require(path.join(compiled,'db.js')),{normalizeColumns,insertColumn}=require(path.join(compiled,'metadata.js')),{initializeDatabase,columnDefinition,createDefaultViews,syncKeyIndex,readColumns}=require(path.join(compiled,'schema.js')),{registerAuditFunctions}=require(path.join(compiled,'audit-schema.js')),{createBackup}=require(path.join(compiled,'backups.js'));
fs.mkdirSync(path.dirname(databasePath),{recursive:true});const d=new Database(databasePath,{fileMustExist:live,timeout:10000});d.pragma('foreign_keys=ON');registerAuditFunctions(d);
const table='load_test_300k',label='ข้อมูลจำลอง 300,000 แถว',rows=300000,started=Date.now();
try{if(!live)initializeDatabase(d,databasePath);
if(d.prepare('SELECT 1 FROM _tables WHERE name=?').get(table)||d.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get('t_'+table))throw Error('Test table already exists; no data was changed');
const disk=fs.statfsSync(path.dirname(databasePath));if(Number(disk.bavail)*Number(disk.bsize)<200*1024*1024)throw Error('At least 200 MB free space is required');
const backup=createBackup(d,databasePath,'manual');console.log(JSON.stringify({stage:'backup',file:path.join(path.dirname(databasePath),'backups',backup.name),bytes:backup.size,live}));
const backupDb=new Database(path.join(path.dirname(databasePath),'backups',backup.name),{readonly:true,fileMustExist:true});try{if(backupDb.pragma('quick_check',{simple:true})!=='ok')throw Error('Backup verification failed');}finally{backupDb.close();}
const result=withDatabase(d,()=>{const columns=normalizeColumns([
{name:'code',label:'รหัสทดสอบ',type:'text',is_key:true,required:true},
{name:'name',label:'ชื่อข้อมูล',type:'text',is_label:true,required:true},
{name:'status',label:'สถานะ',type:'enum',options:'รอดำเนินการ,กำลังดำเนินการ,สำเร็จ,ยกเลิก,ตรวจสอบ'},
{name:'category',label:'หมวดหมู่',type:'enum',options:Array.from({length:12},(_,i)=>'หมวด '+(i+1)).join(',')},
{name:'created_at',label:'วันที่สร้าง',type:'datetime'},
{name:'amount',label:'จำนวนเงิน',type:'decimal'},
{name:'quantity',label:'จำนวน',type:'number'},
{name:'active',label:'ใช้งาน',type:'yesno'}
],{[table]:[]});
return d.transaction(()=>{
 const originalTables=d.prepare('SELECT name FROM _tables ORDER BY name').all().map(t=>({name:t.name,rows:d.prepare('SELECT COUNT(*) AS n FROM "t_'+t.name+'"').get().n}));
 d.prepare('INSERT INTO _tables(name,label,realtime_enabled) VALUES(?,?,0)').run(table,label);columns.forEach(c=>insertColumn(table,c));d.exec('CREATE TABLE "t_'+table+'"(id INTEGER PRIMARY KEY AUTOINCREMENT,'+columns.map(columnDefinition).join(',')+')');syncKeyIndex(d,table);createDefaultViews(d,table,label);
 const view=d.prepare("SELECT name FROM _views WHERE table_name=? AND position='primary'").get(table);d.prepare("UPDATE _views SET kind='table',position='menu',menu_group=?,icon='database',columns_json=?,pos=(SELECT COALESCE(MAX(pos),0)+1 FROM _views) WHERE name=?").run('ทดสอบประสิทธิภาพ',JSON.stringify(columns.map(c=>c.name)),view.name);
 const insert=d.prepare('INSERT INTO "t_'+table+'"(code,name,status,category,created_at,amount,quantity,active) VALUES(?,?,?,?,?,?,?,?)'),statuses=columns.find(c=>c.name==='status').options.split(','),base=Date.parse('2026-10-21T00:00:00+07:00');
 for(let i=1;i<=rows;i++){const hash=(Math.imul(i,2654435761)>>>0),date=new Date(base-(hash%365)*86400000+(i%86400)*1000+7*3600000).toISOString().slice(0,23)+'+07:00';insert.run('TEST-'+String(i).padStart(6,'0'),'ข้อมูลทดสอบ '+String(i).padStart(6,'0'),statuses[hash%5],'หมวด '+(Math.floor(hash/5)%12+1),date,(hash%10000000)/100,hash%50+1,hash%10?1:0);if(i%50000===0)console.log('Inserted '+i+' / '+rows);}
 const count=d.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT code) AS unique_codes,MIN(id) AS first_id,MAX(id) AS last_id FROM "t_'+table+'"').get();if(count.n!==rows||count.unique_codes!==rows)throw Error('Row count validation failed');for(const t of originalTables)if(d.prepare('SELECT COUNT(*) AS n FROM "t_'+t.name+'"').get().n!==t.rows)throw Error('An original table changed inside the transaction');if(d.pragma('foreign_key_check').length)throw Error('Foreign key validation failed');if(readColumns(d,table).length!==8)throw Error('Metadata validation failed');return {table,label,view:view.name,rows:count.n,firstId:count.first_id,lastId:count.last_id,originalTables:originalTables.length};
 }).immediate();});
const check=d.pragma('quick_check',{simple:true});if(check!=='ok')throw Error('SQLite quick_check: '+check);
console.log(JSON.stringify({...result,database:databasePath,backup:backup.name,elapsedMs:Date.now()-started,quickCheck:check,url:'/run?view='+result.view}));
}catch(e){console.error(e.message);process.exitCode=1;}finally{d.close();}
