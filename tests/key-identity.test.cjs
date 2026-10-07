const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const {initializeDatabase,syncKeyIndex}=require('../.test-build/schema.js');
const {calculateRow,formState,assertEditableChanges}=require('../.test-build/columns.js');
const {evaluateExpression,rewriteReferenceListLiterals}=require('../.test-build/expression.js');
const {inspectBackup,restoreBackup}=require('../.test-build/backups.js');
const {cascadeEnumListValues}=require('../.test-build/enumlist-reference-updates.js');
function fixture(file=':memory:'){
 const db=new Database(file);initializeDatabase(db,':memory:');db.exec("INSERT INTO _tables VALUES('products','สินค้า'),('orders','รายการ');CREATE TABLE t_products(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT,name TEXT,active INTEGER);CREATE TABLE t_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,product INTEGER REFERENCES t_products(id),picked TEXT,tags TEXT,notes TEXT);");
 const insert=db.prepare('INSERT INTO _columns(table_name,name,label,type,is_key,is_label,ref_table,default_expr,valid_if,pos) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(const row of [['products','code','รหัส','text',1,0,null,null,null,0],['products','name','ชื่อสินค้า','text',0,1,null,null,null,1],['products','active','ใช้งาน','yesno',0,0,null,null,null,2],['orders','product','สินค้า','ref',0,0,'products',null,null,0],['orders','picked','สินค้าที่เลือก','list',0,0,'products','IF(TRUE, LIST("2"), LIST("1"))','SELECT(products[code], [active]=TRUE)',1],['orders','tags','สิทธิ์','enumlist',0,0,null,null,'products[code]',2],['orders','notes','บันทึก','list',0,0,null,null,null,3]])insert.run(...row);
 db.exec("INSERT INTO t_products(id,code,name,active) VALUES(1,'2','สินค้าหนึ่ง',1),(2,'1','สินค้าสอง',1),(80,'X','ลบแล้ว',0);DELETE FROM t_products WHERE id=80;INSERT INTO t_orders(id,product,picked,tags,notes) VALUES(17,1,'[\"2\",\"1\",\"2\"]','[\"2\"]','[\"2\",\"ข้อความ\"]');");db.prepare("INSERT INTO _actions(name,label,table_name,kind,values_json) VALUES('pick_first','เลือกสินค้า','orders','set',?)").run(JSON.stringify({picked:'LIST("2")'}));syncKeyIndex(db,'products');return db;
}
function old(db){db.exec('ALTER TABLE _app_settings DROP COLUMN list_reference_version');}
function context(){return {tables:{products:{columns:['id','code','name','active'],key:'code',labels:{2:'สินค้าหนึ่ง',1:'สินค้าสอง'},rows:[{id:1,code:'2',name:'สินค้าหนึ่ง',active:1},{id:2,code:'1',name:'สินค้าสอง',active:1}]}}};}
test('legacy List migration matches the old business key even when it collides with another id, keeps ids/Refs/plain lists, backs up WAL and is idempotent',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','identity-')),file=path.join(folder,'data.db'),db=fixture(file);
 try{old(db);db.pragma('journal_mode=WAL');initializeDatabase(db,file);
 assert.deepEqual(JSON.parse(db.prepare('SELECT picked FROM t_orders WHERE id=17').get().picked),['1','2']);assert.equal(db.prepare('SELECT product FROM t_orders WHERE id=17').get().product,1);assert.deepEqual(JSON.parse(db.prepare('SELECT notes FROM t_orders').get().notes),['2','ข้อความ']);assert.equal(db.prepare('SELECT tags FROM t_orders').get().tags,'["2"]');
 assert.equal(db.prepare("SELECT default_expr FROM _columns WHERE name='picked'").get().default_expr,'IF(TRUE, LIST("1"), LIST("2"))');assert.equal(db.prepare('SELECT list_reference_version AS v FROM _app_settings').get().v,1);
 assert.equal(JSON.parse(db.prepare("SELECT values_json FROM _actions WHERE name='pick_first'").get().values_json).picked,'LIST("1")');
 const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/list-reference-ids/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.prepare('SELECT picked FROM t_orders').get().picked,'["2","1","2"]');}finally{backup.close();}
 initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(Number(db.prepare("INSERT INTO t_products(code,name) VALUES('new','ใหม่')").run().lastInsertRowid),81);
 }finally{db.close();}
});
test('missing legacy values roll back all lists, formulas and the migration marker, retaining a backup for repair',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','identity-failure-')),file=path.join(folder,'data.db'),db=fixture(file);
 try{old(db);db.prepare('INSERT INTO t_orders(picked) VALUES(?)').run('["missing"]');assert.throws(()=>initializeDatabase(db,file),/ไม่พบรหัส/);assert.equal(db.prepare('SELECT picked FROM t_orders WHERE id=17').get().picked,'["2","1","2"]');assert.equal(db.pragma("table_info('_app_settings')").some(c=>c.name==='list_reference_version'),false);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);db.prepare('DELETE FROM t_orders WHERE id!=17').run();initializeDatabase(db,file);assert.equal(db.prepare('SELECT picked FROM t_orders').get().picked,'["1","2"]');
 }finally{db.close();}
});
test('restoring an old backup converts List once; restoring a current backup never treats ids as business keys',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','identity-restore-')),file=path.join(folder,'old.db'),db=fixture(file),stage=path.join(folder,'ready.db');
 try{old(db);db.pragma('journal_mode=DELETE');db.close();inspectBackup(file,stage);const target=new Database(':memory:');try{initializeDatabase(target,':memory:');restoreBackup(target,path.join(folder,'live.db'),stage);assert.equal(target.prepare('SELECT picked FROM t_orders').get().picked,'["1","2"]');assert.equal(target.prepare('SELECT product FROM t_orders').get().product,1);const current=path.join(folder,'current.db');target.prepare('VACUUM INTO ?').run(current);inspectBackup(current,path.join(folder,'ready2.db'));restoreBackup(target,path.join(folder,'live.db'),path.join(folder,'ready2.db'));assert.equal(target.prepare('SELECT picked FROM t_orders').get().picked,'["1","2"]');}finally{target.close();}
 }finally{if(db.open)db.close();}
});
test('referenced List SELECT/IF/IFS returns row ids while its conditions, ordinary SELECT and EnumList retain business values',()=>{
 const ctx=context(),c={name:'picked',label:'รายการ',type:'list',ref_table:'products',is_virtual:1,virtual_expr:'IF(IN("2", products[code]), SELECT(products[code], [code]="2"), LIST())'};
 assert.deepEqual(calculateRow([c],{},false,new Date(),false,'',ctx).row.picked,['1']);c.virtual_expr='IFS(TRUE, products[code])';assert.deepEqual(calculateRow([c],{},false,new Date(),false,'',ctx).row.picked,['1','2']);assert.deepEqual(evaluateExpression('SELECT(products[code], TRUE)',{},ctx),['2','1']);
 const field={...c,is_virtual:0,virtual_expr:'',valid_if:'IF(TRUE, SELECT(products[code], [code]="2"), LIST())'};assert.deepEqual(formState([field],{picked:['1']},new Date(),'',ctx).choices.picked,['1']);assert.equal(Object.keys(formState([field],{picked:['1']},new Date(),'',ctx).validation).length,0);assert.match(formState([field],{picked:['2']},new Date(),'',ctx).validation.picked,/Valid_If/);
});
test('literal migration rewrites result branches only, including escaped text, without touching conditions',()=>{
 const source='IF([name]="2", LIST("2"), IF(IN("1", products[code]), LIST(\'1\'), LIST()))';assert.equal(rewriteReferenceListLiterals(source,v=>({2:'1',1:'2'})[v]),'IF([name]="2", LIST("1"), IF(IN("1", products[code]), LIST("2"), LIST()))');
});
test('business keys are editable but still obey read-only flags and Editable_If',()=>{
 const c={name:'code',label:'รหัส',type:'text',is_key:1};assert.equal(formState([c],{id:17,code:'new'}).editable.code,true);assertEditableChanges([c],{id:17,code:'old'},{id:17,code:'new'});assert.throws(()=>assertEditableChanges([{...c,is_editable:0}],{id:17,code:'old'},{id:17,code:'new'}),/อ่านอย่างเดียว/);assert.throws(()=>assertEditableChanges([{...c,editable_if:'FALSE'}],{id:17,code:'old'},{id:17,code:'new'}),/Editable_If/);
});
test('SELECT-backed EnumList follows a renamed business key atomically, preserving selections and rollback',()=>{
 const db=fixture();try{const cols=db.prepare("SELECT * FROM _columns WHERE table_name='products'").all();db.transaction(()=>{db.prepare("UPDATE t_products SET code='P001' WHERE id=1").run();cascadeEnumListValues(db,'products',cols,{code:'2'},{code:'P001'});})();assert.equal(db.prepare('SELECT tags FROM t_orders').get().tags,'["P001"]');assert.throws(()=>db.transaction(()=>{db.prepare("UPDATE t_products SET code='P002' WHERE id=1").run();cascadeEnumListValues(db,'products',cols,{code:'P001'},{code:'P002'});throw Error('rollback');})(),/rollback/);assert.equal(db.prepare('SELECT tags FROM t_orders').get().tags,'["P001"]');}finally{db.close();}
});

test('current backups with missing List ids are rejected before restoring live contents',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','identity-corrupt-')),file=path.join(folder,'bad.db'),db=fixture(file);
 try{db.prepare('UPDATE t_orders SET picked=?').run('["999"]');db.pragma('journal_mode=DELETE');db.close();assert.throws(()=>inspectBackup(file,path.join(folder,'ready.db')),/รหัสภายในที่ไม่มีอยู่/);}finally{if(db.open)db.close();}
});
