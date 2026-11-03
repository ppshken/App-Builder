const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','readiness-unit-'));process.env.NOCODE_DB_PATH=path.join(folder,'isolated.db');const {db,withDatabase}=require('../.test-build/db.js'),{withDraftLock}=require('../.test-build/releases.js');
test('request-local databases stay isolated across asynchronous requests',async()=>{const a=new Database(':memory:'),b=new Database(':memory:');for(const [database,value]of [[a,'draft A'],[b,'draft B']]){database.exec('CREATE TABLE marker(value TEXT)');database.prepare('INSERT INTO marker VALUES(?)').run(value);}try{await Promise.all([[a,'draft A',25],[b,'draft B',5]].map(([database,value,ms])=>withDatabase(database,async()=>{await new Promise(r=>setTimeout(r,ms));assert.equal(db.prepare('SELECT value FROM marker').get().value,value);})));assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='marker'").get().n,0);}finally{a.close();b.close();}});
test('draft requests serialize and a rejected operation releases the next request',async()=>{const id='11111111-1111-4111-8111-111111111111',order=[];await Promise.all([withDraftLock(id,async()=>{order.push('start');await new Promise(r=>setTimeout(r,15));order.push('end');}),withDraftLock(id,async()=>{order.push('second');})]);assert.deepEqual(order,['start','end','second']);await assert.rejects(withDraftLock(id,async()=>{throw Error('expected');}));assert.equal(await withDraftLock(id,async()=>42),42);});

function readinessFixture(){
 const d=new Database(':memory:');const {initializeDatabase,createDefaultViews}=require('../.test-build/schema.js');initializeDatabase(d,':memory:');
 d.exec("INSERT INTO _tables(name,label) VALUES('ready','Ready'),('parents','Parents'); INSERT INTO _columns(table_name,name,label,type) VALUES('ready','name','Name','text'),('ready','amount','Amount','number'),('parents','name','Name','text'); CREATE TABLE t_ready(id INTEGER PRIMARY KEY,name TEXT,amount REAL); CREATE TABLE t_parents(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO t_ready VALUES(1,'Existing data',4);");
 createDefaultViews(d,'ready','Ready');createDefaultViews(d,'parents','Parents');return d;
}
test('pre-publish checks report every formula, stale View fields and navigation without changing data',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js');try{withDatabase(d,()=>{
  assert.equal(inspectApp().errors,0);
  d.prepare("UPDATE _columns SET default_expr='[missing]' WHERE table_name='ready'").run();
  d.prepare("UPDATE _views SET sort_column='gone' WHERE table_name='ready' AND kind='list'").run();
  d.prepare("UPDATE _app_settings SET home_view='gone'").run();
  const before=d.serialize();const report=inspectApp(true);
  assert.equal(report.status,'blocked');assert(report.issues.filter(i=>i.kind==='formula').length>=2);
  assert(report.issues.some(i=>i.kind==='view'&&i.href.startsWith('/views?view=')));
  assert(report.issues.some(i=>i.kind==='settings'&&i.href==='/settings'));
  assert.deepEqual(d.serialize(),before);
 });}finally{d.close();}
});
test('pre-publish permission checks include missing Ref access, impossible grants and invalid row rules',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js');try{withDatabase(d,()=>{
  d.exec("INSERT INTO _application_local_roles(app_id,name,label) VALUES('default','staff','Staff'); INSERT INTO _application_role_tables(app_id,role_name,table_name,can_read,can_create) VALUES('default','staff','ready',1,1),('default','staff','parents',0,1); INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES('ready','parent','Parent','ref','parents'); INSERT INTO _application_role_rows(app_id,role_name,table_name,operation,expression) VALUES('default','staff','ready','read','[missing] = 1');");
  const before=d.serialize(),report=inspectApp();
  assert(report.issues.some(i=>i.kind==='permission'&&i.severity==='warning'&&i.message.includes('ปลายทาง')));
  assert(report.issues.some(i=>i.kind==='permission'&&i.severity==='error'&&i.message.includes('ยังไม่มีสิทธิ์อ่าน')));
  assert(report.issues.some(i=>i.kind==='permission'&&i.message.includes('กฎสิทธิ์แถว')));
  assert(report.issues.filter(i=>i.kind==='permission').every(i=>i.href==='/app-access'));
  assert.deepEqual(d.serialize(),before);
 });}finally{d.close();}
});
test('pre-publish role findings stay inside the selected application',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js'),{withApplication}=require('../.test-build/application-context.js'),{createApplicationConfig}=require('../.test-build/application-schema.js');try{withDatabase(d,()=>{
  const id='a_'+ 'e'.repeat(24);d.prepare('INSERT INTO _applications(id,label,created_at) VALUES(?,?,0)').run(id,'Other');createApplicationConfig(d,id,'Other');
  d.exec("INSERT INTO _application_local_roles(app_id,name,label) VALUES('default','staff','Only default'); INSERT INTO _application_role_tables(app_id,role_name,table_name,can_read,can_create) VALUES('default','staff','ready',0,1);");
  const report=withApplication({id,datasets:{ready:{read:true,create:true,update:true,delete:true}}},()=>inspectApp());
  assert(!report.issues.some(i=>i.kind==='permission'&&i.name==='staff'));
 });}finally{d.close();}
});

test('builders see incomplete permission-check status without private role details',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js'),{runAuthorized}=require('../.test-build/permissions.js');try{withDatabase(d,()=>{
  d.exec("INSERT INTO _application_local_roles(app_id,name,label) VALUES('default','private_role','Private role');");
  const report=runAuthorized({id:42,name:'Builder',email:'builder@example.test',role:'builder'},{owner:false,builder:true,tables:{},actions:[]},()=>inspectApp());
  assert.equal(report.status,'review');assert.equal(report.errors,0);assert(report.skipped.length>0);
  assert(!report.issues.some(i=>i.kind==='permission'));assert(!JSON.stringify(report).includes('private_role'));
 });}finally{d.close();}
});

test('health checks exclude retained views and source configuration on unreadable app datasets',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js'),{runAuthorized}=require('../.test-build/permissions.js'),{withApplication}=require('../.test-build/application-context.js');try{withDatabase(d,()=>{
  d.prepare("UPDATE _views SET sort_column='stale' WHERE table_name='ready'").run();
  d.exec("INSERT INTO _actions(name,label,table_name,kind) VALUES('retained','Retained','ready','set'); INSERT INTO _slices(name,label,table_name,filter_expr) VALUES('retained_slice','Retained slice','ready','[gone] = 1');");
  const datasets={ready:{read:false,create:false,update:false,delete:false},parents:{read:true,create:true,update:true,delete:true}},user={id:1,name:'Owner',email:'owner@example.test',role:'owner'};
  const inspect=()=>withApplication({id:'default',datasets},()=>runAuthorized(user,{owner:true,builder:true,tables:{},actions:[],datasets},()=>inspectApp()));
  const before=d.serialize(),report=inspect();assert.equal(report.errors,0);assert.equal(report.excluded.View,3);assert.equal(report.excluded.Action,1);assert.equal(report.excluded.Slice,1);assert.deepEqual(d.serialize(),before);
  const hidden=d.prepare("SELECT name FROM _views WHERE table_name='ready' AND kind='list'").get().name;
  d.prepare("INSERT INTO _actions(name,label,table_name,kind,config_json) VALUES('visible_link','Visible link','parents','open_view',?)").run(JSON.stringify({view_name:hidden}));
  assert(inspect().issues.some(i=>i.name==='visible_link'&&i.kind==='action'));
 });}finally{d.close();}
});
test('genuinely missing view tables still fail readiness instead of being silently excluded',()=>{
 const d=readinessFixture(),{inspectApp}=require('../.test-build/readiness.js');try{withDatabase(d,()=>{
  d.pragma('foreign_keys=OFF');d.exec("INSERT INTO _views(name,label,table_name,kind,position) VALUES('dangling','Missing table','gone','list','primary')");
  const report=inspectApp();assert(report.issues.some(i=>i.name==='dangling'&&i.message.includes('ไม่พบตารางของ View')));assert.equal(report.excluded.View,undefined);
 });}finally{d.close();}
});
