const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { initializeDatabase, readColumns, rebuildTable, foreignKeyTransaction } = require('../.test-build/schema.js');

function legacy(db) {
  db.exec(`CREATE TABLE _tables(name TEXT PRIMARY KEY,label TEXT NOT NULL);
    CREATE TABLE _columns(id INTEGER PRIMARY KEY AUTOINCREMENT,table_name TEXT NOT NULL REFERENCES _tables(name) ON DELETE CASCADE,name TEXT NOT NULL,label TEXT NOT NULL,type TEXT NOT NULL,options TEXT,ref_table TEXT,required INTEGER DEFAULT 0,pos INTEGER DEFAULT 0,UNIQUE(table_name,name));
    INSERT INTO _tables(name,label) VALUES('customers','ลูกค้า'),('orders','รายการ');
    INSERT INTO _columns(table_name,name,label,type,required,pos) VALUES('customers','name','ชื่อ','text',1,0),('orders','note','หมายเหตุ','text',0,0);
    INSERT INTO _columns(table_name,name,label,type,ref_table,pos) VALUES('orders','customer','ลูกค้า','ref','customers',1);
    CREATE TABLE t_customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL);
    CREATE TABLE t_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,note TEXT,customer INTEGER REFERENCES t_customers(id));
    INSERT INTO t_customers(id,name) VALUES(1,'ไทย'),(99,'ลบแล้ว'); DELETE FROM t_customers WHERE id=99;
    INSERT INTO t_orders(note,customer) VALUES('เดิม',1);`);
}
test('legacy migration keeps metadata, rows, foreign keys and AUTOINCREMENT history; repeat is harmless', () => {
  const db = new Database(':memory:'); legacy(db);
  try {
    initializeDatabase(db, ':memory:');
    assert.equal(readColumns(db, 'customers')[0].is_virtual, 0);
    assert.equal(readColumns(db, 'customers')[0].is_part_of, 0);
    assert.equal(readColumns(db, 'orders').find(c=>c.name==='customer').part_valid_if, null);
    assert.equal(db.prepare('SELECT name FROM t_customers WHERE id=1').get().name, 'ไทย');
    assert.equal(db.pragma("table_info('t_customers')").find(c => c.name === 'name').notnull, 0);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(Number(db.prepare('INSERT INTO t_customers(name) VALUES(?)').run('ใหม่').lastInsertRowid), 100);
    initializeDatabase(db, ':memory:');
    assert.throws(() => db.prepare('DELETE FROM t_customers WHERE id=1').run(), /FOREIGN KEY/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _columns').get().n, 3);
  } finally { db.close(); }
});
test('consistent backup includes WAL rows and precedes metadata migration', () => {
  const folder = fs.mkdtempSync(path.join(process.cwd(), '.test-data', 'backup-'));
  const file = path.join(folder, 'data.db'), db = new Database(file);
  try {
    db.pragma('journal_mode=WAL'); legacy(db);
    initializeDatabase(db, file);
    const backups = fs.readdirSync(path.join(folder, 'backups')); assert.equal(backups.length, 1);
    const backup = new Database(path.join(folder, 'backups', backups[0]), { readonly: true });
    assert.equal(backup.prepare('SELECT name FROM t_customers WHERE id=1').get().name, 'ไทย');
    assert.equal(backup.pragma("table_info('_columns')").some(c => c.name === 'virtual_expr'), false); backup.close();
    initializeDatabase(db, file); assert.equal(fs.readdirSync(path.join(folder, 'backups')).length, 1);
  } finally { db.close(); }
});
test('drop last physical column supports virtual-only tables and retains ids', () => {
  const db = new Database(':memory:'); legacy(db); initializeDatabase(db, ':memory:');
  try {
    db.prepare("INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('orders','computed','คำนวณ','number',1,'5')").run();
    foreignKeyTransaction(db, () => { db.prepare("DELETE FROM _columns WHERE table_name='orders' AND name IN ('note','customer')").run(); rebuildTable(db, 'orders'); });
    assert.deepEqual(db.pragma("table_info('t_orders')").map(c => c.name), ['id']);
    assert.equal(db.prepare('SELECT id FROM t_orders').get().id, 1);
    assert.equal(Number(db.prepare('INSERT INTO t_orders DEFAULT VALUES').run().lastInsertRowid), 2);
  } finally { db.close(); }
});
test('failed rebuild rolls back metadata and rows, and restores FK enforcement', () => {
  const db = new Database(':memory:'); legacy(db); initializeDatabase(db, ':memory:');
  try {
    assert.throws(() => foreignKeyTransaction(db, () => { db.prepare("DELETE FROM _columns WHERE table_name='customers'").run(); rebuildTable(db, 'customers'); db.prepare('DELETE FROM t_customers WHERE id=1').run(); }), /อ้างอิง/);
    assert.equal(readColumns(db, 'customers').length, 1);
    assert.equal(db.prepare('SELECT name FROM t_customers WHERE id=1').get().name, 'ไทย');
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally { db.close(); }
});
test('unsafe names and prototype type names cannot become SQL identifiers', () => {
  const db = new Database(':memory:'); legacy(db); initializeDatabase(db, ':memory:');
  try {
    assert.throws(() => readColumns(db, 'customers"; DROP TABLE _tables;--'), /ชื่อในระบบ/);
    db.prepare("UPDATE _columns SET type='constructor' WHERE table_name='customers'").run();
    assert.throws(() => readColumns(db, 'customers'), /ชนิดข้อมูล/);
  } finally { db.close(); }
});
test('view migration on an existing expression database creates consistent backup and default views only once', () => {
  const folder = fs.mkdtempSync(path.join(process.cwd(), '.test-data', 'views-backup-'));
  const file = path.join(folder, 'data.db'), db = new Database(file);
  try {
    legacy(db); initializeDatabase(db, ':memory:');
    db.exec('DROP TABLE _views; ALTER TABLE _columns DROP COLUMN is_key; ALTER TABLE _columns DROP COLUMN is_label;');
    db.pragma('journal_mode=WAL');
    initializeDatabase(db, file);
    const files = fs.readdirSync(path.join(folder, 'backups')); assert.equal(files.length, 1); assert.match(files[0], /before-views/);
    const backup = new Database(path.join(folder, 'backups', files[0]), { readonly: true });
    try { assert.equal(backup.prepare("SELECT 1 FROM sqlite_master WHERE name='_views'").get(), undefined); assert.equal(backup.prepare('SELECT name FROM t_customers WHERE id=1').get().name, 'ไทย'); } finally { backup.close(); }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _views').get().n, 7);
    assert.equal(readColumns(db, 'customers')[0].is_key, 0);
    initializeDatabase(db, file); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _views').get().n, 7); assert.equal(fs.readdirSync(path.join(folder, 'backups')).length, 1);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  } finally { db.close(); }
});
test('slice/action migration preserves saved views and WAL data, backs up before upgrading, and is repeatable', () => {
  const folder = fs.mkdtempSync(path.join(process.cwd(), '.test-data', 'rules-backup-'));
  const file = path.join(folder, 'data.db'), db = new Database(file);
  try {
    legacy(db); initializeDatabase(db, ':memory:');
    db.exec('ALTER TABLE _views DROP COLUMN slice_name; DROP TABLE _slices; DROP TABLE _actions;');
    db.prepare("UPDATE _views SET label='ตั้งค่าเดิม',columns_json='[\"name\"]' WHERE name='view_1'").run();
    db.pragma('journal_mode=WAL'); db.prepare("INSERT INTO t_customers(name) VALUES('จาก WAL')").run();
    initializeDatabase(db, file);
    const files=fs.readdirSync(path.join(folder,'backups')); assert.equal(files.length,1);assert.match(files[0],/before-slices-actions/);
    const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});
    try { assert.equal(backup.prepare("SELECT 1 FROM sqlite_master WHERE name='_slices'").get(),undefined);assert.equal(backup.prepare("SELECT name FROM t_customers ORDER BY id DESC").get().name,'จาก WAL'); } finally {backup.close();}
    const view=db.prepare("SELECT * FROM _views WHERE name='view_1'").get();assert.equal(view.label,'ตั้งค่าเดิม');assert.equal(view.columns_json,'["name"]');assert.equal(view.slice_name,null);
    initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _views').get().n,7);assert.deepEqual(db.pragma('foreign_key_check'),[]);
  } finally { db.close(); }
});
test('screen defaults migration backs up WAL, preserves app and View overrides, and runs once',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','display-defaults-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{legacy(db);initializeDatabase(db,':memory:');db.exec('ALTER TABLE _app_settings DROP COLUMN display_defaults_json');db.prepare("UPDATE _app_settings SET name='แอพเดิม',font='prompt'").run();db.prepare("UPDATE _views SET display_json=? WHERE name='view_1'").run(JSON.stringify({list_style:'card'}));db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ข้อมูลใน WAL ก่อนตั้งค่ากลาง')").run();initializeDatabase(db,file);
 const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-display-defaults/);const old=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.ok(!old.pragma("table_info('_app_settings')").some(c=>c.name==='display_defaults_json'));assert.equal(old.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ข้อมูลใน WAL ก่อนตั้งค่ากลาง');}finally{old.close();}
 const settings=db.prepare('SELECT * FROM _app_settings').get();assert.equal(settings.name,'แอพเดิม');assert.equal(settings.font,'prompt');assert.equal(settings.display_defaults_json,'{}');assert.equal(db.prepare("SELECT display_json FROM _views WHERE name='view_1'").get().display_json,'{"list_style":"card"}');db.prepare('UPDATE _app_settings SET display_defaults_json=?').run('{"detail":{"detail_padding":24}}');initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.equal(db.prepare('SELECT display_defaults_json FROM _app_settings').get().display_defaults_json,'{"detail":{"detail_padding":24}}');assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('app settings migration backs up existing data and keeps views, slices and actions intact', () => {
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','settings-backup-')),file=path.join(folder,'data.db'),db=new Database(file);
 try {
  legacy(db);initializeDatabase(db,':memory:');db.exec('DROP TABLE _app_settings');
  db.prepare("INSERT INTO _slices(name,label,table_name,filter_expr) VALUES('customers_slice','เดิม','customers','TRUE')").run();db.prepare("UPDATE _views SET slice_name='customers_slice' WHERE name='view_1'").run();
  db.prepare("INSERT INTO _actions(name,label,table_name,kind) VALUES('customers_delete','ลบ','customers','delete')").run();db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ข้อมูลใน WAL')").run();
  initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-app-settings/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});
  try {assert.equal(backup.prepare("SELECT 1 FROM sqlite_master WHERE name='_app_settings'").get(),undefined);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ข้อมูลใน WAL');}finally{backup.close();}
  assert.deepEqual(db.prepare('SELECT name,icon,color,mode FROM _app_settings').get(),{name:'No-code Builder',icon:'grid',color:'blue',mode:'auto'});assert.equal(db.prepare("SELECT slice_name FROM _views WHERE name='view_1'").get().slice_name,'customers_slice');assert.equal(db.prepare('SELECT COUNT(*) n FROM _actions').get().n,1);
  initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
test('Image storage migration captures WAL backup before adding the table and is idempotent',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','images-backup-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{legacy(db);initializeDatabase(db,':memory:');db.exec('DROP TABLE _images');db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ก่อนอัปเกรดรูปภาพ')").run();initializeDatabase(db,file);
 const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-images/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.prepare("SELECT 1 FROM sqlite_master WHERE name='_images'").get(),undefined);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ก่อนอัปเกรดรูปภาพ');}finally{backup.close();}
 db.prepare('INSERT INTO _images(id,mime,data) VALUES(?,?,?)').run('fixture','image/png',Buffer.from([1,2,3]));initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.prepare('SELECT data FROM _images').get().data,Buffer.from([1,2,3]));assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('view options migration preserves views and WAL rows, backs up first and is idempotent', () => {
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','view-options-')),file=path.join(folder,'data.db'),db=new Database(file);
 try {legacy(db);initializeDatabase(db,':memory:');db.exec('ALTER TABLE _views DROP COLUMN icon; ALTER TABLE _views DROP COLUMN group_column; ALTER TABLE _views DROP COLUMN group_dir;');db.prepare("UPDATE _views SET label='มุมมองเดิม',columns_json='[\"name\"]' WHERE name='view_1'").run();db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ข้อมูลก่อนอัปเกรด')").run();initializeDatabase(db,file);
 const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-view-options/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.pragma("table_info('_views')").some(c=>c.name==='icon'),false);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ข้อมูลก่อนอัปเกรด');}finally{backup.close();}
 const view=db.prepare("SELECT * FROM _views WHERE name='view_1'").get();assert.equal(view.label,'มุมมองเดิม');assert.equal(view.columns_json,'["name"]');assert.equal(view.icon,'');assert.equal(view.group_column,'');assert.equal(view.group_dir,'asc');db.prepare("UPDATE _views SET icon='home',group_column='name' WHERE name='view_1'").run();initializeDatabase(db,file);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.equal(db.prepare("SELECT icon FROM _views WHERE name='view_1'").get().icon,'home');assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('screen layout migration backs up existing views and WAL before adding display settings; repeat preserves edits',()=>{const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','view-display-')),file=path.join(folder,'data.db'),db=new Database(file);try{legacy(db);initializeDatabase(db,':memory:');db.exec('ALTER TABLE _views DROP COLUMN display_json');db.prepare("UPDATE _views SET icon='home',group_column='name' WHERE name='view_1'").run();db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ก่อนรูปแบบหน้าจอ')").run();initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-view-display/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.pragma("table_info('_views')").some(c=>c.name==='display_json'),false);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ก่อนรูปแบบหน้าจอ');}finally{backup.close();}const v=db.prepare("SELECT * FROM _views WHERE name='view_1'").get();assert.equal(v.icon,'home');assert.equal(v.group_column,'name');assert.equal(v.display_json,'{}');db.prepare("UPDATE _views SET display_json=? WHERE name='view_1'").run(JSON.stringify({list_style:'card'}));initializeDatabase(db,file);assert.equal(JSON.parse(db.prepare("SELECT display_json FROM _views WHERE name='view_1'").get().display_json).list_style,'card');assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);}finally{db.close();}});

test('Show_If migration backs up WAL data and existing display events before adding metadata and is repeatable',()=>{const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','view-events-')),file=path.join(folder,'data.db'),db=new Database(file);try{legacy(db);initializeDatabase(db,':memory:');db.exec('ALTER TABLE _views DROP COLUMN show_if');db.prepare("UPDATE _views SET icon='home',display_json=? WHERE name='view_1'").run(JSON.stringify({row_click:'edit'}));db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ก่อนเพิ่มเงื่อนไข')").run();initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-view-visibility/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.pragma("table_info('_views')").some(c=>c.name==='show_if'),false);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ก่อนเพิ่มเงื่อนไข');}finally{backup.close();}const v=db.prepare("SELECT * FROM _views WHERE name='view_1'").get();assert.equal(v.show_if,'');assert.equal(JSON.parse(v.display_json).row_click,'edit');db.prepare("UPDATE _views SET show_if='FALSE' WHERE name='view_1'").run();initializeDatabase(db,file);assert.equal(db.prepare("SELECT show_if FROM _views WHERE name='view_1'").get().show_if,'FALSE');assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);}finally{db.close();}});

test('Appearance migration backs up WAL and preserves existing settings, views and data; rerun keeps edits',()=>{const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','appearance-')),file=path.join(folder,'data.db'),db=new Database(file);try{legacy(db);initializeDatabase(db,':memory:');for(const name of ['font','font_size','loading_style','loading_text','custom_color'])db.exec('ALTER TABLE _app_settings DROP COLUMN '+name);db.prepare("UPDATE _app_settings SET name='ชื่อเดิม',icon='truck',color='purple',mode='dark'").run();db.pragma('journal_mode=WAL');db.prepare("INSERT INTO t_customers(name) VALUES('ก่อนตั้งค่าฟอนต์')").run();initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-app-appearance/);const backup=new Database(path.join(folder,'backups',files[0]),{readonly:true});try{assert.equal(backup.pragma("table_info('_app_settings')").some(c=>c.name==='font'),false);assert.equal(backup.prepare('SELECT name FROM t_customers ORDER BY id DESC').get().name,'ก่อนตั้งค่าฟอนต์');}finally{backup.close();}const s=db.prepare('SELECT * FROM _app_settings').get();assert.equal(s.name,'ชื่อเดิม');assert.equal(s.icon,'truck');assert.equal(s.color,'purple');assert.equal(s.mode,'dark');assert.equal(s.font,'sarabun');assert.equal(s.font_size,14);assert.equal(s.loading_style,'text');assert.equal(s.loading_text,'กำลังโหลด…');db.prepare("UPDATE _app_settings SET font='prompt',font_size=18,custom_color='#00FF99'").run();initializeDatabase(db,file);assert.equal(db.prepare('SELECT font FROM _app_settings').get().font,'prompt');assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);}finally{db.close();}});

test('Related list migration preserves WAL and old metadata, indexes reverse refs and keeps saved limits on repeat',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','list-migration-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{legacy(db);initializeDatabase(db,':memory:');db.exec('ALTER TABLE _columns DROP COLUMN list_limit');db.pragma('journal_mode=WAL');db.prepare('INSERT INTO t_orders(note,customer) VALUES(?,?)').run('ข้อมูลใน WAL',1);
 initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-related-lists/);const old=new Database(path.join(folder,'backups',files[0]));try{assert.equal(old.prepare('SELECT COUNT(*) AS n FROM t_orders').get().n,2);assert.ok(!old.pragma("table_info('_columns')").some(c=>c.name==='list_limit'));}finally{old.close();}
 assert.equal(readColumns(db,'orders').find(c=>c.name==='customer').list_limit,5);assert.ok(db.prepare('EXPLAIN QUERY PLAN SELECT * FROM t_orders WHERE customer=? ORDER BY id LIMIT 5').all(1).some(r=>r.detail.includes('_ref_')));db.prepare("UPDATE _columns SET list_limit=20 WHERE table_name='orders' AND name='customer'").run();initializeDatabase(db,file);assert.equal(readColumns(db,'orders').find(c=>c.name==='customer').list_limit,20);assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('Inline migration backs up WAL, preserves original layouts and creates one view per physical Ref only once',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','inline-migration-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{legacy(db);initializeDatabase(db,':memory:');db.exec("DELETE FROM _views WHERE position='inline'; ALTER TABLE _views DROP COLUMN inline_ref");db.prepare("UPDATE _views SET display_json=? WHERE name='view_1'").run(JSON.stringify({list_style:'card'}));db.pragma('journal_mode=WAL');db.prepare('INSERT INTO t_orders(note,customer) VALUES(?,?)').run('แถวใน WAL',1);initializeDatabase(db,file);
 const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-inline-views/);const old=new Database(path.join(folder,'backups',files[0]));try{assert.ok(!old.pragma("table_info('_views')").some(c=>c.name==='inline_ref'));assert.equal(old.prepare('SELECT COUNT(*) n FROM t_orders').get().n,2);}finally{old.close();}
 const v=db.prepare("SELECT * FROM _views WHERE position='inline'").all();assert.equal(v.length,1);assert.equal(v[0].table_name,'orders');assert.equal(v[0].inline_ref,'customer');assert.equal(JSON.parse(db.prepare("SELECT display_json FROM _views WHERE name='view_1'").get().display_json).list_style,'card');db.prepare("UPDATE _views SET kind='table' WHERE name=?").run(v[0].name);initializeDatabase(db,file);assert.equal(db.prepare("SELECT kind FROM _views WHERE name=?").get(v[0].name).kind,'table');assert.equal(fs.readdirSync(path.join(folder,'backups')).length,1);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('Ref cascade migration preserves previously authorized links once and leaves other references disabled',()=>{const db=new Database(':memory:');legacy(db);db.exec("INSERT INTO _tables(name,label) VALUES('inspection','Inspection'),('inspection_image','Images'),('list_inspection','Items'); INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES('inspection_image','inspection_id','Inspection','ref','inspection'),('list_inspection','inspection_id','Inspection','ref','inspection'); CREATE TABLE t_inspection(id INTEGER PRIMARY KEY AUTOINCREMENT); CREATE TABLE t_inspection_image(id INTEGER PRIMARY KEY AUTOINCREMENT,inspection_id INTEGER REFERENCES t_inspection(id)); CREATE TABLE t_list_inspection(id INTEGER PRIMARY KEY AUTOINCREMENT,inspection_id INTEGER REFERENCES t_inspection(id));");try{initializeDatabase(db,':memory:');assert.equal(readColumns(db,'inspection_image')[0].ref_delete_cascade,1);assert.equal(readColumns(db,'list_inspection')[0].ref_delete_cascade,1);assert.equal(readColumns(db,'orders').find(c=>c.name==='customer').ref_delete_cascade,0);db.prepare("UPDATE _columns SET ref_delete_cascade=0 WHERE table_name='inspection_image'").run();initializeDatabase(db,':memory:');assert.equal(readColumns(db,'inspection_image')[0].ref_delete_cascade,0);}finally{db.close();}});
