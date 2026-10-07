const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');
const {initializeDatabase,readColumns,syncKeyIndex,rebuildTable,foreignKeyTransaction}=require('../.test-build/schema.js');
const {assertUniqueRow,uniqueErrorFields,duplicateGroups,assertUniqueColumn}=require('../.test-build/unique.js');
const {previewConversion,applyConversion}=require('../.test-build/column-conversion.js');
const {createBackup,backupFile,inspectBackup,restoreBackup}=require('../.test-build/backups.js');
function fixture(file=':memory:',unique=0){const db=new Database(file);initializeDatabase(db,':memory:');db.prepare("INSERT INTO _tables VALUES('items','รายการ')").run();db.prepare("INSERT INTO _columns(table_name,name,label,type,is_unique) VALUES('items','value','รหัส','text',?)").run(unique);db.exec('CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,value TEXT)');syncKeyIndex(db,'items');return db;}
test('SQLite and application enforce unique scalar values, exclude the edited row, and agree on all blank values',()=>{
 const db=fixture(':memory:',1);try{const insert=db.prepare('INSERT INTO t_items(value) VALUES(?)');for(const value of [null,null,'','','  ','  ','\t','\t','\u00a0','\u00a0','\u3000','\u3000','A','a',' A'])insert.run(value);
 const columns=readColumns(db,'items'),id=db.prepare("SELECT id FROM t_items WHERE value='A'").get().id;assert.throws(()=>assertUniqueRow(db,'items',columns,{value:'A'}),e=>{assert.ok(uniqueErrorFields(e).value.includes('รหัส'));return true;});assertUniqueRow(db,'items',columns,{value:'A'},id);assert.throws(()=>insert.run('A'),/UNIQUE/);assert.equal(duplicateGroups(db,'items',columns[0]).groups,0);assert.throws(()=>assertUniqueColumn({name:'items',label:'รายการ',type:'list',is_unique:1}),/ค่าเดียว/);
 }finally{db.close();}
});
test('opening uniqueness on dirty data rolls back metadata and provides grouped row IDs for repair',()=>{
 const db=fixture();try{db.exec("INSERT INTO t_items(value) VALUES('A'),('A'),('B'),('B'),('B'),(NULL),(NULL)");let cols=readColumns(db,'items'),report=duplicateGroups(db,'items',cols[0]);assert.equal(report.groups,2);assert.equal(report.rows,5);assert.deepEqual(report.duplicates[0],{value:'B',count:3,ids:[3,4,5]});
 assert.throws(()=>db.transaction(()=>{db.prepare('UPDATE _columns SET is_unique=1').run();syncKeyIndex(db,'items');})(),/แถว 3, 4, 5/);assert.equal(readColumns(db,'items')[0].is_unique,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM t_items').get().n,7);
 db.exec("UPDATE t_items SET value='B2' WHERE id=4;UPDATE t_items SET value='B3' WHERE id=5;UPDATE t_items SET value='A2' WHERE id=2;UPDATE _columns SET is_unique=1");syncKeyIndex(db,'items');assert.throws(()=>db.prepare("INSERT INTO t_items(value) VALUES('A')").run(),/UNIQUE/);
 }finally{db.close();}
});
test('unique migration backs up WAL and leaves prior data editable without uniqueness by default',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','unique-migration-')),file=path.join(folder,'data.db'),db=fixture(file);
 try{db.pragma('journal_mode=WAL');db.exec("INSERT INTO t_items(value) VALUES('A'),('A');ALTER TABLE _columns DROP COLUMN is_unique");initializeDatabase(db,file);assert.equal(readColumns(db,'items')[0].is_unique,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM t_items').get().n,2);const names=fs.readdirSync(path.join(folder,'backups'));assert.equal(names.length,1);assert.match(names[0],/unique-columns/);const saved=new Database(backupFile(file,names[0]),{readonly:true});assert.equal(saved.pragma("table_info('_columns')").some(c=>c.name==='is_unique'),false);assert.equal(saved.prepare('SELECT COUNT(*) AS n FROM t_items').get().n,2);saved.close();initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);
 }finally{db.close();}
});
test('rename and rebuild retain uniqueness and ID history; disabling uniqueness removes only its managed index',()=>{
 const db=fixture(':memory:',1);try{db.exec("INSERT INTO t_items(id,value) VALUES(1,'A'),(80,'ลบ');DELETE FROM t_items WHERE id=80;ALTER TABLE t_items RENAME COLUMN value TO code;UPDATE _columns SET name='code' WHERE name='value'");syncKeyIndex(db,'items');assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='_unique_items_value'").get(),undefined);assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='_unique_items_code'").get());foreignKeyTransaction(db,()=>rebuildTable(db,'items'));assert.throws(()=>db.prepare("INSERT INTO t_items(code) VALUES('A')").run(),/UNIQUE/);assert.equal(Number(db.prepare("INSERT INTO t_items(code) VALUES('B')").run().lastInsertRowid),81);db.prepare('UPDATE _columns SET is_unique=0').run();syncKeyIndex(db,'items');db.prepare("INSERT INTO t_items(code) VALUES('A')").run();assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
test('conversion cannot collide unique values; copying leaves originals protected and does not inherit uniqueness',()=>{
 const db=fixture(':memory:',1);try{db.exec("INSERT INTO t_items(value) VALUES('01'),('1')");let request={column:'value',mode:'replace',target:{type:'decimal'}},report=previewConversion(db,'items',request);assert.equal(report.allowed,false);assert.ok(report.issues.some(i=>i.message.includes('ซ้ำ')));assert.equal(readColumns(db,'items')[0].is_unique,1);
 request={column:'value',mode:'copy',target:{type:'decimal',name:'number_value',label:'ตัวเลข'}};report=previewConversion(db,'items',request);assert.equal(report.allowed,true,JSON.stringify(report));applyConversion(db,'items',request);assert.equal(readColumns(db,'items').find(c=>c.name==='number_value').is_unique,0);assert.deepEqual(db.prepare('SELECT number_value FROM t_items').all(),[{number_value:1},{number_value:1}]);assert.throws(()=>db.prepare("INSERT INTO t_items(value) VALUES('01')").run(),/UNIQUE/);
 }finally{db.close();}
});
test('backup and recovery recreate managed uniqueness rules with the data',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','unique-recovery-')),file=path.join(folder,'data.db'),db=fixture(file,1);
 try{db.prepare("INSERT INTO t_items(value) VALUES('A')").run();const backup=createBackup(db,file),stage=path.join(folder,'ready.db');inspectBackup(backupFile(file,backup.name),stage);db.prepare('UPDATE _columns SET is_unique=0').run();syncKeyIndex(db,'items');restoreBackup(db,file,stage);assert.equal(readColumns(db,'items')[0].is_unique,1);assert.throws(()=>db.prepare("INSERT INTO t_items(value) VALUES('A')").run(),/UNIQUE/);
 }finally{db.close();}
});
