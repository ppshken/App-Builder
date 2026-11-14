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
 let reads=0;const prepare=database.prepare;database.prepare=function(sql){if(sql.includes('FROM "t_sample_rows" ORDER BY id')&&!sql.includes('SELECT id FROM'))reads++;return prepare.call(this,sql);};const options={limit:1000,samplePerTable:100,deadline:Date.now()+10000,email:'',now:new Date(),collectIssues:true},result=validateReleaseRows(database,['sample_rows'],options);assert.equal(result.checked,100);assert.equal(result.invalid,0);assert.equal(reads,1,'formula source loaded once, not once per sample row');
 const before=dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100);assert.equal(before.tables[0].rows,10000);database.exec('UPDATE t_sample_rows SET amount=77 WHERE id=5000');assert.equal(dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100).hash,before.hash,'unsampled rows are not claimed as checked');database.exec('UPDATE t_sample_rows SET amount=77 WHERE id=10000');assert.notEqual(dataFingerprint(database,['sample_rows'],1000,Date.now()+10000,undefined,undefined,100).hash,before.hash);assert.equal(validateReleaseRows(database,['sample_rows'],{...options,limit:25}).checked,25);
 });}finally{database.close();}
});
