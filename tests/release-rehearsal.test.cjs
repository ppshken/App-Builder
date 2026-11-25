const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {rehearsalEligibility,dataFingerprint}=require('../.test-build/release-rehearsal');
const base={_tables:[{name:'orders',owner_app_id:'app',source_kind:'INTERNAL_DATABASE'}],_columns:[{id:1,table_name:'orders',name:'title',type:'text'}]};
const plan=operations=>({appId:'app',operations,conflicts:[],summary:{liveChanged:false}});
test('release row validation shares calculation rules, preserves data and enforces row/time budgets',()=>{
 const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{validateReleaseRows}=require('../.test-build/release-rehearsal');
 const database=new Database(':memory:');try{
 initializeDatabase(database,':memory:');database.prepare("INSERT INTO _tables(name,label,owner_app_id,source_kind) VALUES('validation_rows','Fixture','default','INTERNAL_DATABASE')").run();
 database.exec('CREATE TABLE t_validation_rows(id INTEGER PRIMARY KEY,amount REAL);INSERT INTO t_validation_rows VALUES(1,2),(2,4)');
 database.prepare("INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('validation_rows','amount','Amount','number',0,NULL),('validation_rows','score','Score','number',1,'10 / [amount]')").run();
 withDatabase(database,()=>{
  const options=()=>({limit:2,deadline:Date.now()+10000,now:new Date(),email:''});
  assert.deepEqual(validateReleaseRows(database,['validation_rows'],options()),{checked:2,invalid:0});
  assert.throws(()=>validateReleaseRows(database,['validation_rows'],{...options(),limit:1}),/ขีดจำกัด/);
  assert.throws(()=>validateReleaseRows(database,['validation_rows'],{...options(),deadline:Date.now()-1}),/ขีดจำกัด|หมดเวลา/);
  database.exec('UPDATE t_validation_rows SET amount=0 WHERE id=2');
  assert.deepEqual(validateReleaseRows(database,['validation_rows'],options()),{checked:2,invalid:1});
  const detailed=validateReleaseRows(database,['validation_rows'],{...options(),collectIssues:true});
  assert.deepEqual(detailed.issues,[{table:'validation_rows',tableLabel:'Fixture',column:'score',columnLabel:'Score',kind:'calculation',count:1}]);
  assert.equal(detailed.omittedIssueRows,0);
  database.exec("ALTER TABLE t_validation_rows ADD COLUMN note TEXT;UPDATE t_validation_rows SET note='private fixture value' WHERE id=2");
  database.prepare("UPDATE _columns SET virtual_expr='1' WHERE name='score'").run();
  database.prepare("UPDATE _columns SET valid_if='[_THIS] > 0',invalid_value_error='private custom error' WHERE name='amount'").run();
  database.prepare("INSERT INTO _columns(table_name,name,label,type,required) VALUES('validation_rows','note','Note','text',1)").run();
  const mixed=validateReleaseRows(database,['validation_rows'],{...options(),collectIssues:true});
  assert.equal(mixed.invalid,2);assert.deepEqual(mixed.issues.map(i=>[i.column,i.kind,i.count]),[['note','required',1],['amount','validation',1]]);
  assert.ok(!JSON.stringify(mixed).includes('private'),'reports never include cell values or custom error text');
  assert.deepEqual(database.prepare('SELECT id,amount FROM t_validation_rows ORDER BY id').all(),[{id:1,amount:2},{id:2,amount:0}]);
 });
 }finally{database.close();}
});
test('rehearsal allows nullable additions but rejects destructive, required and shared changes',()=>{
 const next=structuredClone(base);next._columns.push({id:2,table_name:'orders',name:'note',type:'text',is_virtual:0});
 const op={kind:'create_column',category:'schema',table:'orders',name:'note'};
 assert.deepEqual(rehearsalEligibility(plan([op]),base,next),[]);
 next._columns[1].is_unique=1;assert.ok(rehearsalEligibility(plan([op]),base,next).length);
 next._columns[1].is_unique=0;next._tables[0].owner_app_id='other';assert.ok(rehearsalEligibility(plan([op]),base,next).length);
 for(const kind of ['delete_table','delete_column','alter_column','alter_table'])assert.ok(rehearsalEligibility(plan([{...op,kind}]),base,next).length);
});
test('rehearsal rejects metadata drift, conflicts and unsupported table sources',()=>{
 assert.ok(rehearsalEligibility({...plan([]),summary:{liveChanged:true}},base,base).length);
 assert.ok(rehearsalEligibility({...plan([]),blockers:[{code:'LIVE_CHANGED'}]},base,base).length,'global catalog drift must remain blocked even when app-scoped fingerprints match');
 assert.ok(rehearsalEligibility({...plan([]),conflicts:[{}]},base,base).length);
 const next=structuredClone(base);next._tables.push({name:'remote',owner_app_id:'app',source_kind:'EXTERNAL_REST_API'});
 assert.ok(rehearsalEligibility(plan([{kind:'create_table',category:'schema',table:'remote'}]),base,next).length);
});
test('data fingerprint detects row updates despite unchanged counts and never exposes values',()=>{
 const db=new Database(':memory:');try{db.exec('CREATE TABLE t_orders(id INTEGER PRIMARY KEY,title TEXT);INSERT INTO t_orders VALUES(1,\'private fixture\')');
 const a=dataFingerprint(db,['orders']);assert.equal(a.tables[0].rows,1);assert.ok(!JSON.stringify(a).includes('private fixture'));assert.deepEqual(a,dataFingerprint(db,['orders']));
 db.exec("UPDATE t_orders SET title='changed'");assert.notEqual(a.hash,dataFingerprint(db,['orders']).hash);
 db.exec('UPDATE t_orders SET id=9007199254740992');const large=dataFingerprint(db,['orders']).hash;db.exec('UPDATE t_orders SET id=9007199254740993');assert.notEqual(large,dataFingerprint(db,['orders']).hash,'64-bit integer updates must not disappear through JS Number rounding');
 assert.throws(()=>dataFingerprint(db,['orders'],0),/ขีดจำกัด/);assert.throws(()=>dataFingerprint(db,['orders;DROP TABLE t_orders']),/ชื่อ/);
 }finally{db.close();}
});
test('schema rehearsal refuses an unverified connection and rolls back failed DDL/config together',()=>{
 const {initializeDatabase}=require('../.test-build/schema'),{initializeDevelopment}=require('../.test-build/development-workspace'),{withDevelopment}=require('../.test-build/development-context'),{applyRehearsalSchema}=require('../.test-build/release-rehearsal');
 const db=new Database(':memory:');try{
 initializeDatabase(db,':memory:');db.prepare("INSERT INTO _tables(name,label,owner_app_id,source_kind) VALUES('orders','Orders','app','INTERNAL_DATABASE')").run();db.exec('CREATE TABLE t_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT);INSERT INTO t_orders(title) VALUES(\'Keep original\')');
 initializeDevelopment(db,'scratch','app',['orders']);
 const next={...structuredClone(base),_columns:[{table_name:'orders',name:'memo',label:'Memo',type:'text',is_virtual:0,id:77}]},p={...plan([{kind:'create_column',category:'schema',table:'orders',name:'memo'}])};
 assert.throws(()=>applyRehearsalSchema(db,p,base,next,()=>{}),/สำเนา/);
 withDevelopment({id:'scratch',sourceAppId:'app',databaseFile:':memory:'},()=>{
  assert.throws(()=>applyRehearsalSchema(db,p,base,next,()=>{throw Error('config failed');}),/config failed/);
  assert.ok(!db.pragma('table_info(t_orders)').some(c=>c.name==='memo'));assert.equal(db.prepare('SELECT count(*) n FROM _columns WHERE name=?').get('memo').n,0);assert.equal(db.prepare('SELECT title FROM t_orders').get().title,'Keep original');
  let staged;applyRehearsalSchema(db,p,base,next,catalog=>{staged=catalog;});assert.ok(db.pragma('table_info(t_orders)').some(c=>c.name==='memo'));assert.equal(db.prepare('SELECT memo FROM t_orders').get().memo,null);
  assert.equal(staged._columns[0].id,db.prepare("SELECT id FROM _columns WHERE name='memo'").get().id);assert.notEqual(staged._columns[0].id,77);assert.equal(next._columns[0].id,77,'the workspace catalog is never mutated');
 });
 }finally{db.close();}
});
test('fast rehearsal samples head/tail within budget, keeps real counts and reuses read-only formula data',()=>{
 const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{validateReleaseRows,rehearsalRows}=require('../.test-build/release-rehearsal');const database=new Database(':memory:');try{initializeDatabase(database,':memory:');withDatabase(database,()=>{
 database.exec("INSERT INTO _tables(name,label) VALUES('sample_rows','Sample');INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('sample_rows','amount','Amount','number',0,NULL),('sample_rows','count_rows','Count','number',1,'COUNT(SELECT(sample_rows[id], [amount] = [_THISROW].[amount]))');CREATE TABLE t_sample_rows(id INTEGER PRIMARY KEY,amount REAL);WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10000) INSERT INTO t_sample_rows SELECT x,x%100 FROM n");
 const query=rehearsalRows('sample_rows',100,'id'),ids=database.prepare(query.sql).pluck().all(...query.args);assert.equal(ids.length,100);assert.deepEqual(ids.slice(0,3),[1,2,3]);assert.deepEqual(ids.slice(-3),[9998,9999,10000]);
 let reads=0;const prepare=database.prepare;database.prepare=function(sql){if(sql.includes('FROM "t_sample_rows" ORDER BY id')&&!sql.includes('SELECT id FROM'))reads++;return prepare.call(this,sql);};const options={limit:1000,samplePerTable:100,deadline:Date.now()+10000,email:'',now:new Date(),collectIssues:true},result=validateReleaseRows(database,['sample_rows'],options);assert.equal(result.checked,100);assert.equal(result.invalid,0);assert.ok(reads<=1,'source is aggregated in SQL or loaded once, never once per sample row');
 const before=dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100);assert.equal(before.tables[0].rows,10000);database.exec('UPDATE t_sample_rows SET amount=77 WHERE id=5000');assert.equal(dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100).hash,before.hash,'unsampled rows are not claimed as checked');database.exec('UPDATE t_sample_rows SET amount=77 WHERE id=10000');assert.notEqual(dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100).hash,before.hash);assert.equal(validateReleaseRows(database,['sample_rows'],{...options,limit:25}).checked,25);
 });}finally{database.close();}
});

test('rehearsal validates child cardinality in parent context without exposing data',()=>{
 const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{validateReleaseRows}=require('../.test-build/release-rehearsal');const database=new Database(':memory:');
 try{initializeDatabase(database,':memory:');database.exec("INSERT INTO _tables(name,label) VALUES('parents','Parent'),('children','Child');CREATE TABLE t_parents(id INTEGER PRIMARY KEY);CREATE TABLE t_children(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES t_parents(id));INSERT INTO t_parents VALUES(1),(2);INSERT INTO t_children VALUES(1,1),(2,1);INSERT INTO _columns(table_name,name,label,type,ref_table,is_part_of,related_required,part_valid_if,part_invalid_value_error) VALUES('children','parent','Parent link','ref','parents',1,1,'COUNT([_THIS]) = 2','private error')");
 withDatabase(database,()=>{const result=validateReleaseRows(database,['parents'],{limit:10,deadline:Date.now()+10000,email:'',now:new Date(),collectIssues:true});assert.equal(result.invalid,1);assert.ok(!JSON.stringify(result).includes('private error'));database.exec('INSERT INTO t_children VALUES(3,2),(4,2)');assert.equal(validateReleaseRows(database,['parents'],{limit:10,deadline:Date.now()+10000,email:'',now:new Date()}).invalid,0);database.exec('INSERT INTO t_children VALUES(5,2)');assert.equal(validateReleaseRows(database,['parents'],{limit:10,deadline:Date.now()+10000,email:'',now:new Date()}).invalid,1);});
 }finally{database.close();}
});

test('rehearsal and publication accept Text to Enum without rewriting live values',()=>{
 const {publicationBlockers,requiresPublicationRowValidation}=require('../.test-build/release-publication-policy');
 const next=structuredClone(base);next._columns[0].type='enum';next._columns[0].options='A,B';
 const op={id:'_columns:1',kind:'alter_column',category:'schema',table:'orders',name:'title',fields:['type','options']},p=plan([op]);
 assert.deepEqual(rehearsalEligibility(p,base,next),[]);assert.deepEqual(publicationBlockers(p,base,next,[],0),[]);
 assert.equal(requiresPublicationRowValidation(p,next),true);assert.ok(publicationBlockers(p,base,next,['orders'],0).length);
 const numeric=structuredClone(base);numeric._columns[0].type='number';
 const numericPlan=plan([{...op,fields:['type']}]);
 assert.deepEqual(rehearsalEligibility(numericPlan,base,numeric),[]);
 assert.equal(requiresPublicationRowValidation(numericPlan,numeric),true);
 for(const change of [{name:'renamed'},{is_virtual:1},{is_key:1},{ref_table:'another'}]){const bad=structuredClone(next);Object.assign(bad._columns[0],change);assert.ok(rehearsalEligibility(p,base,bad).length,JSON.stringify(change));}
});

test('preserving type executor keeps data and SQL objects, rolls metadata back and validates Enum values',()=>{
 const {initializeDatabase,readColumns}=require('../.test-build/schema'),{initializeDevelopment}=require('../.test-build/development-workspace'),{withDevelopment}=require('../.test-build/development-context'),{withDatabase}=require('../.test-build/db'),{applyRehearsalSchema,validateReleaseRows}=require('../.test-build/release-rehearsal');
 const database=new Database(':memory:');try{
 initializeDatabase(database,':memory:');database.prepare("INSERT INTO _tables(name,label,owner_app_id,source_kind) VALUES('orders','Orders','app','INTERNAL_DATABASE')").run();
 const id=Number(database.prepare("INSERT INTO _columns(table_name,name,label,type) VALUES('orders','title','Title','text')").run().lastInsertRowid);
 database.exec("CREATE TABLE t_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT);INSERT INTO t_orders(title) VALUES('A'),('B');CREATE INDEX keep_title ON t_orders(title);CREATE TRIGGER keep_trigger AFTER UPDATE ON t_orders BEGIN SELECT 1; END");
 initializeDevelopment(database,'scratch_types','app',['orders']);
 const live={_tables:database.prepare("SELECT * FROM _tables WHERE name='orders'").all(),_columns:database.prepare("SELECT * FROM _columns WHERE table_name='orders'").all()},next=structuredClone(live);next._columns[0].type='enum';next._columns[0].options='A,B';
 const p=plan([{id:'_columns:'+id,kind:'alter_column',category:'schema',table:'orders',name:'title',fields:['type','options']}]);
 const before=database.prepare('SELECT * FROM t_orders ORDER BY id').all(),physical=database.prepare("SELECT name,sql FROM sqlite_master WHERE tbl_name='t_orders' ORDER BY name").all();
 withDatabase(database,()=>withDevelopment({id:'scratch_types',sourceAppId:'app',databaseFile:':memory:'},()=>{
 assert.throws(()=>applyRehearsalSchema(database,p,live,next,()=>{throw Error('config failed');}),/config failed/);
 assert.equal(database.prepare('SELECT type FROM _columns WHERE id=?').get(id).type,'text');
 applyRehearsalSchema(database,p,live,next,c=>database.prepare('UPDATE _columns SET options=? WHERE id=?').run(c._columns[0].options,id));
 assert.equal(readColumns(database,'orders')[0].type,'enum');
 assert.deepEqual(database.prepare('SELECT * FROM t_orders ORDER BY id').all(),before);assert.deepEqual(database.prepare("SELECT name,sql FROM sqlite_master WHERE tbl_name='t_orders' ORDER BY name").all(),physical);
 const options={limit:100,deadline:Date.now()+10000,now:new Date(),email:'',collectIssues:true};assert.equal(validateReleaseRows(database,['orders'],options).invalid,0);
 database.prepare('UPDATE _columns SET options=? WHERE id=?').run('A',id);const invalid=validateReleaseRows(database,['orders'],options);assert.equal(invalid.invalid,1);assert.equal(invalid.issues[0].column,'title');
 assert.deepEqual(database.prepare('SELECT * FROM t_orders ORDER BY id').all(),before);
 }));
 }finally{database.close();}
});

test('publication accepts virtual reference changes while guarding stored row IDs and external targets',()=>{
 const op={id:'_columns:1',kind:'alter_column',category:'schema',table:'orders',name:'linked',fields:['ref_table']};
 const tables=['orders','customers','contacts'].map(name=>({name,owner_app_id:'default',source_kind:'INTERNAL_DATABASE'}));
 const col={id:1,table_name:'orders',name:'linked',type:'ref',is_virtual:1,ref_table:'customers',virtual_expr:'1'};
 const live={_tables:tables,_columns:[col]};
 const next={_tables:tables,_columns:[{...col,ref_table:'contacts'}]};
 const {preservingColumnTypeChange}=require('../.test-build/release-column-types.js');
 assert.equal(preservingColumnTypeChange(op,live,next),true);
 assert.equal(preservingColumnTypeChange(op,{...live,_columns:[{...col,is_virtual:0}]},{...next,_columns:[{...next._columns[0],is_virtual:0}]}),false);
 assert.equal(preservingColumnTypeChange(op,live,{...next,_tables:tables.map(t=>t.name==='contacts'?{...t,owner_app_id:'elsewhere'}:t)}),false);
});

test('column rename preserves physical rows, indexes and fingerprint and rolls back on failure',()=>{
 const {applyPublicationSchema}=require('../.test-build/release-rehearsal');
 const database=new Database(':memory:');
 try{
  database.exec("CREATE TABLE _columns(id INTEGER PRIMARY KEY,table_name TEXT,name TEXT,type TEXT);INSERT INTO _columns VALUES(1,'orders','title','text');CREATE TABLE t_orders(id INTEGER PRIMARY KEY,title TEXT);INSERT INTO t_orders VALUES(1,'kept');CREATE INDEX orders_lookup ON t_orders(title)");
  const next=structuredClone(base);next._columns[0].name='caption';
  const op={id:'_columns:1',kind:'alter_column',category:'schema',table:'orders',name:'caption',label:'Caption',fields:['name']};
  const release={...plan([op]),appId:'app'};
  const before=dataFingerprint(database,['orders']).hash;
  assert.throws(()=>database.transaction(()=>applyPublicationSchema(database,release,base,next,()=>{throw Error('stop')}))(),/stop/);
  assert.equal(database.prepare('SELECT title FROM t_orders').get().title,'kept');
  database.transaction(()=>applyPublicationSchema(database,release,base,next,()=>{}))();
  assert.equal(database.prepare('SELECT caption FROM t_orders').get().caption,'kept');
  assert.equal(database.prepare("SELECT name FROM _columns WHERE id=1").get().name,'caption');
  assert.equal(database.pragma('index_info(orders_lookup)')[0].name,'caption');
  assert.equal(dataFingerprint(database,['orders'],10,Date.now()+5000,{orders:['id','title']},undefined,undefined,{orders:{title:'caption'}}).hash,before);
 }finally{database.close();}
});
test('simple additive rehearsal scopes row validation and falls back for dependent changes', () => {
  const { additiveRehearsalScope } = require('../.test-build/release-rehearsal');
  const op = { id: '_columns:1', kind: 'create_column', table: 'orders', name: 'memo' };
  const next = { _columns: [{ table_name: 'orders', name: 'memo', type: 'text' }] };
  assert.deepEqual([...additiveRehearsalScope({ operations: [op, { id: '_views:new', kind: 'create_configuration', table: 'other' }] }, next)], ['orders']);
  assert.equal(additiveRehearsalScope({ operations: [op] }, { _columns: [{ ...next._columns[0], valid_if: 'TRUE' }] }), null);
  assert.equal(additiveRehearsalScope({ operations: [{ ...op, kind: 'alter_column' }] }, next), null);
});
