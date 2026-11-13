const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {initializeDevelopment,verifyDevelopment,developmentAccess,developmentOrigins}=require('../.test-build/development-workspace');
const {withDevelopment,currentDevelopment,assertDevelopmentEffect,assertDevelopmentAction}=require('../.test-build/development-context');
const {analyzeReleasePlan}=require('../.test-build/release-plan');
function fixture(work){const database=new Database(':memory:');database.exec(`CREATE TABLE _tables(name TEXT PRIMARY KEY,owner_app_id TEXT,source_kind TEXT DEFAULT 'INTERNAL_DATABASE');CREATE TABLE _columns(id INTEGER PRIMARY KEY,table_name TEXT,name TEXT,type TEXT);CREATE TABLE _sessions(token_hash TEXT);CREATE TABLE _users(password_hash TEXT);CREATE TABLE _push_subscriptions(id TEXT);INSERT INTO _tables(name,owner_app_id) VALUES('rows','app'),('shared','other');INSERT INTO _columns VALUES(1,'rows','title','text');INSERT INTO _users VALUES('synthetic-secret');INSERT INTO _sessions VALUES('synthetic-token');INSERT INTO _push_subscriptions VALUES('synthetic-subscription');`);try{initializeDevelopment(database,'workspace','app',['rows','shared']);return work(database);}finally{database.close();}}
test('development stores provenance only in the copied database and removes copied auth secrets',()=>fixture(database=>{
 verifyDevelopment(database,'workspace','app');assert.throws(()=>verifyDevelopment(database,'workspace','other'),/แอปต้นทาง/);assert.equal(database.prepare('SELECT count(*) n FROM _sessions').get().n,0);assert.equal(database.prepare('SELECT password_hash FROM _users').get().password_hash,'');assert.equal(database.prepare('SELECT count(*) n FROM _push_subscriptions').get().n,0);assert.equal(developmentOrigins(database).tables.rows.sourceKey,'rows');
}));
test('rename preserves identity; delete/recreate never reuses lineage even with the same metadata ID',()=>fixture(database=>{
 const first=developmentOrigins(database).columns['rows:1'];database.prepare("UPDATE _columns SET name='renamed' WHERE id=1").run();assert.equal(developmentOrigins(database).columns['rows:1'].uid,first.uid);
 database.prepare('DELETE FROM _columns WHERE id=1').run();database.prepare("INSERT INTO _columns VALUES(1,'rows','title','text')").run();const fresh=developmentOrigins(database).columns['rows:1'];assert.notEqual(fresh.uid,first.uid);assert.equal(fresh.sourceKey,null);assert.equal(database.prepare('SELECT retired FROM _development_objects WHERE uid=?').get(first.uid).retired,1);
 const base={_tables:[{name:'rows',owner_app_id:'app'}],_columns:[{id:1,table_name:'rows',name:'title',type:'text'}]};const plan=analyzeReleasePlan(base,base,base,{appId:'app',workspaceId:'workspace',origins:developmentOrigins(database)});assert.equal(plan.summary.schema,2);assert.deepEqual(new Set(plan.operations.map(o=>o.kind)),new Set(['delete_column','create_column']));
}));
test('lineage triggers roll back with existing SQL transactions',()=>fixture(database=>{
 const before=database.prepare('SELECT count(*) n FROM _development_objects').get().n;assert.throws(()=>database.transaction(()=>{database.prepare("INSERT INTO _tables(name,owner_app_id) VALUES('temporary','app')").run();database.prepare("INSERT INTO _columns VALUES(2,'temporary','value','text')").run();throw Error('rollback');})());assert.equal(database.prepare('SELECT count(*) n FROM _development_objects').get().n,before);assert.equal(developmentOrigins(database).tables.temporary,undefined);
}));
test('new owned tables are usable on later requests; copied shared tables remain read-only',()=>fixture(database=>{
 database.prepare("INSERT INTO _tables(name,owner_app_id) VALUES('new_rows','app')").run();const rights={read:true,create:true,update:true,delete:true,export:true},app={id:'app',datasets:{rows:rights,shared:rights}},access={owner:true,builder:true,tables:{},actions:[],datasets:app.datasets};const scoped=developmentAccess(database,app,access);assert.equal(scoped.access.datasets.new_rows.create,true);assert.equal(scoped.access.datasets.rows.update,true);assert.equal(scoped.access.datasets.shared.read,true);assert.equal(scoped.access.datasets.shared.update,false);assert.equal(app.datasets.shared.update,true,'live input must not mutate');
 delete app.datasets.rows;assert.equal(developmentAccess(database,app,access).access.datasets.rows,undefined,'revoked original source cannot become a new development table');
}));
const context={id:'one',sourceAppId:'app',databaseFile:'isolated.db'};
test('development scope survives await and isolates concurrent requests',async()=>{
 await Promise.all(['one','two'].map(id=>withDevelopment({...context,id},async()=>{await new Promise(r=>setTimeout(r,id==='one'?5:1));assert.equal(currentDevelopment().id,id);assert.throws(()=>assertDevelopmentEffect('network'),{status:409});})));assert.equal(currentDevelopment(),undefined);assert.doesNotThrow(()=>assertDevelopmentEffect('network'));
});
test('internal row actions stay available, external/navigation actions are denied in development',()=>withDevelopment(context,()=>{
 for(const kind of ['set','add','copy','delete','grouped'])assert.doesNotThrow(()=>assertDevelopmentAction(kind));for(const kind of ['automation','open_url','email','navigate','unknown'])assert.throws(()=>assertDevelopmentAction(kind),{status:409});
}));
test('network, push, workflow queue and physical file sinks reject before any real operation',async()=>withDevelopment(context,async()=>{
 const {requestExternalJson}=require('../.test-build/external-http'),{deliverPush}=require('../.test-build/push-notifications'),{copyImageFile}=require('../.test-build/image-files'),{copyAttachmentFile}=require('../.test-build/file-storage'),{enqueueManual,enqueueWorkflow}=require('../.test-build/workflows');
 let budget=0,transport=0;await assert.rejects(requestExternalJson('https://example.invalid',{},'app',()=>budget++),{status:409});assert.equal(budget,0);
 await assert.rejects(deliverPush(null,{app:'app',jobId:'job',step:0,recipients:[1]},()=>null,()=>{},async()=>{transport++;},null),{status:409});assert.equal(transport,0);
 assert.throws(()=>copyImageFile('unused.db','not-created','invalid','image/png',Buffer.alloc(0)),{status:409});assert.throws(()=>copyAttachmentFile('unused.db','not-created','invalid','file.txt',Buffer.alloc(0)),{status:409});assert.throws(()=>enqueueManual('test',1),{status:409});assert.throws(()=>enqueueWorkflow({},{} ,'create'),{status:409});
}));
