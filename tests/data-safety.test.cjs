const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const {initializeDatabase}=require('../.test-build/schema.js');
const {formState,assertEditableChanges,calculateInsertRow}=require('../.test-build/columns.js');
const {createBackup,inspectBackup,restoreBackup,backupFile}=require('../.test-build/backups.js');
const cols=[{name:'status',label:'สถานะ',type:'text'},{name:'amount',label:'ยอด',type:'decimal',editable_if:'[status] <> "approved"'},{name:'stamp',label:'รหัส',type:'text',is_editable:0,default_expr:'"AUTO"'}];
test('editability migration snapshots the prior schema and preserves existing rows and settings on repeat',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','editable-migration-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{initializeDatabase(db,':memory:');db.prepare("INSERT INTO _tables VALUES('items','สินค้า')").run();db.prepare("INSERT INTO _columns(table_name,name,label,type) VALUES('items','name','ชื่อ','text')").run();db.exec("CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);INSERT INTO t_items(name) VALUES('เดิม');ALTER TABLE _columns DROP COLUMN editable_if;ALTER TABLE _columns DROP COLUMN is_editable;");
 initializeDatabase(db,file);assert.equal(db.prepare('SELECT is_editable FROM _columns').get().is_editable,1);assert.equal(db.prepare('SELECT name FROM t_items').get().name,'เดิม');const names=fs.readdirSync(path.join(folder,'backups'));assert.equal(names.length,1);const backup=new Database(path.join(folder,'backups',names[0]),{readonly:true});assert.equal(backup.pragma("table_info('_columns')").some(c=>c.name==='is_editable'),false);backup.close();
 db.prepare("UPDATE _columns SET is_editable=0,editable_if='TRUE'").run();initializeDatabase(db,file);assert.equal(db.prepare('SELECT is_editable FROM _columns').get().is_editable,0);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);
 }finally{db.close();}
});
test('read-only defaults and Editable_If enforce old and proposed values',()=>{
 assert.equal(calculateInsertRow(cols,{status:'draft',amount:5}).stamp,'AUTO');
 assert.throws(()=>calculateInsertRow(cols,{status:'draft',stamp:'FORGED'}),/อ่านอย่างเดียว/);
 const old={id:1,status:'draft',amount:5,stamp:'AUTO'};
 assertEditableChanges(cols,old,{...old,amount:8});
 assert.throws(()=>assertEditableChanges(cols,old,{...old,stamp:'OTHER'}),/อ่านอย่างเดียว/);
 assert.throws(()=>assertEditableChanges(cols,old,{...old,status:'approved',amount:8}),/Editable_If/);
 const approved={...old,status:'approved'};
 assert.throws(()=>assertEditableChanges(cols,approved,{...old,amount:8}),/Editable_If/);
 assert.equal(formState(cols,approved,undefined,'',{},approved).editable.amount,false);
});
test('WAL snapshot restores metadata, images, settings and id history with pre-restore backup',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','safety-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{
 initializeDatabase(db,':memory:');db.pragma('journal_mode=WAL');
 db.prepare('INSERT INTO _images(id,mime,data) VALUES(?,?,?)').run('image-test','image/png',Buffer.from('test-image'));
 db.prepare("UPDATE _app_settings SET name='ทดสอบกู้คืน'").run();
 db.prepare('INSERT INTO _tables(name,label) VALUES(?,?)').run('items','สินค้า');
 db.prepare("INSERT INTO _columns(table_name,name,label,type,is_editable,editable_if) VALUES('items','name','ชื่อ','text',0,'TRUE')").run();
 db.exec("CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);INSERT INTO t_items VALUES(1,'เดิม'),(90,'ลบ');DELETE FROM t_items WHERE id=90;");
 const backup=createBackup(db,file),stage=path.join(folder,'ready.db'),summary=inspectBackup(backupFile(file,backup.name),stage);
 assert.equal(summary.rows,1);assert.equal(summary.images,1);assert.equal(summary.appName,'ทดสอบกู้คืน');db.prepare("UPDATE t_items SET name='ใหม่'").run();db.prepare('DELETE FROM _images').run();
 const before=restoreBackup(db,file,stage);assert.equal(db.prepare('SELECT name FROM t_items').get().name,'เดิม');assert.equal(db.prepare('SELECT is_editable FROM _columns').get().is_editable,0);
 assert.equal(db.prepare('SELECT data FROM _images').get().data.toString(),'test-image');
 assert.equal(Number(db.prepare("INSERT INTO t_items(name) VALUES('อีก')").run().lastInsertRowid),91);assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(db.pragma('foreign_keys',{simple:true}),1);
 const saved=new Database(backupFile(file,before.name),{readonly:true});assert.equal(saved.prepare('SELECT name FROM t_items').get().name,'ใหม่');saved.close();
 assert.throws(()=>backupFile(file,'../data.db'),/ไม่ถูกต้อง/);
 const bad=path.join(folder,'bad.db');fs.writeFileSync(bad,'invalid');assert.throws(()=>inspectBackup(bad,path.join(folder,'bad-ready.db')),/SQLite/);
 }finally{db.close();}
});
test('legacy snapshot is upgraded in staging without changing the source; reject SQL triggers',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','legacy-safety-')),file=path.join(folder,'legacy.db'),db=new Database(file);
 try{db.exec("CREATE TABLE _tables(name TEXT PRIMARY KEY,label TEXT);CREATE TABLE _columns(id INTEGER PRIMARY KEY AUTOINCREMENT,table_name TEXT,name TEXT,label TEXT,type TEXT,options TEXT,ref_table TEXT,required INTEGER,pos INTEGER);INSERT INTO _tables VALUES('items','สินค้า');INSERT INTO _columns(table_name,name,label,type,pos) VALUES('items','name','ชื่อ','text',0);CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);INSERT INTO t_items(name) VALUES('เดิม');");
 const summary=inspectBackup(file,path.join(folder,'ready.db'));assert.equal(summary.rows,1);assert.equal(summary.views,3);assert.equal(db.pragma("table_info('_columns')").some(c=>c.name==='is_editable'),false);
 db.exec('CREATE TRIGGER unsupported AFTER INSERT ON t_items BEGIN UPDATE t_items SET name=name; END');assert.throws(()=>inspectBackup(file,path.join(folder,'rejected.db')),/Trigger/);
 }finally{db.close();}
});
test('failed restore rolls back dropped tables and leaves foreign keys enabled',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','rollback-safety-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{initializeDatabase(db,':memory:');db.prepare("INSERT INTO _tables VALUES('items','สินค้า')").run();db.prepare("INSERT INTO _columns(table_name,name,label,type) VALUES('items','name','ชื่อ','text')").run();db.exec("CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);INSERT INTO t_items(name) VALUES('เดิม');");
 const backup=createBackup(db,file),stageFile=path.join(folder,'ready.db');inspectBackup(backupFile(file,backup.name),stageFile);const stage=new Database(stageFile);stage.pragma("foreign_keys=OFF");stage.exec("UPDATE _columns SET table_name='missing'");stage.close();
 assert.throws(()=>restoreBackup(db,file,stageFile),/อ้างอิง/);assert.equal(db.prepare('SELECT name FROM t_items').get().name,'เดิม');assert.equal(db.pragma('foreign_keys',{simple:true}),1);
 }finally{db.close();}
});
