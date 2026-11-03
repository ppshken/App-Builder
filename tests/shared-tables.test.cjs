const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {initializeDatabase,createDefaultViews,columnDefinition}=require('../.test-build/schema');
const {withDatabase,db,columnsOf}=require('../.test-build/db'),{withApplication}=require('../.test-build/application-context'),{applicationScopeFor,createApplication}=require('../.test-build/applications');
const {runAuthorized,accessFor}=require('../.test-build/permissions'),{sharedCatalog,shareTable,importSharedTable,saveSharedSettings,regenerateShared}=require('../.test-build/shared-tables');
const owner={id:1,name:'Fixture owner',email:'fixture@example.test',role:'owner'},field={name:'title',label:'Title',type:'text'};
function fixture(work){const d=new Database(':memory:');try{initializeDatabase(d,':memory:');withDatabase(d,()=>{d.prepare("INSERT INTO _tables(name,label,owner_app_id) VALUES('shared_people','People','default')").run();for(const [pos,c] of [field,{name:'upstream_calc',label:'Source formula',type:'text',is_virtual:1,virtual_expr:'CONCATENATE([title], " source")'}].entries())d.prepare('INSERT INTO _columns(table_name,name,label,type,pos,is_virtual,virtual_expr) VALUES(?,?,?,?,?,?,?)').run('shared_people',c.name,c.label,c.type,pos,c.is_virtual||0,c.virtual_expr||null);d.exec('CREATE TABLE t_shared_people(id INTEGER PRIMARY KEY AUTOINCREMENT,'+columnDefinition(field)+')');createDefaultViews(d,'shared_people','People');const app=createApplication('Recipient','');const run=(id,fn)=>withApplication(applicationScopeFor(owner,id),()=>runAuthorized(owner,accessFor(owner),fn));work(d,app.id,run);});}finally{d.close();}}
test('shared import keeps physical data, excludes upstream virtuals, isolates labels and formulas',()=>fixture((d,id,run)=>{
 d.prepare('INSERT INTO t_shared_people(title) VALUES(?)').run('Alice');
 run(id,()=>{assert.equal(sharedCatalog().tables[0].columns.length,1);importSharedTable('shared_people');});
 run(id,()=>{assert.deepEqual(columnsOf('shared_people').map(c=>c.name),['title']);saveSharedSettings('shared_people',{op:'column',name:'title',label:'Local title',is_label:true});saveSharedSettings('shared_people',{op:'label',label:'My people'});saveSharedSettings('shared_people',{op:'virtual',column:{name:'local_calc',label:'Local formula',type:'text',virtual_expr:'CONCATENATE([title], " local")'}});assert.equal(columnsOf('shared_people')[0].label,'Local title');assert.deepEqual(columnsOf('shared_people').map(c=>c.name),['title','local_calc']);});
 run('default',()=>{assert.equal(columnsOf('shared_people')[0].label,'Title');assert.ok(columnsOf('shared_people').some(c=>c.name==='upstream_calc'));assert.ok(!columnsOf('shared_people').some(c=>c.name==='local_calc'));});
 assert.deepEqual(d.pragma('table_info(t_shared_people)').map(c=>c.name),['id','title']);assert.equal(d.prepare('SELECT title FROM t_shared_people').get().title,'Alice');assert.deepEqual(d.pragma('foreign_key_check'),[]);
}));
test('regen previews additions, protects local settings and rejects a stale token',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));
 run(id,()=>saveSharedSettings('shared_people',{op:'column',name:'title',label:'Local',is_label:true}));
 d.prepare("INSERT INTO _columns(table_name,name,label,type,pos) VALUES('shared_people','extra','Extra','text',2)").run();d.exec('ALTER TABLE t_shared_people ADD COLUMN extra TEXT');
 run(id,()=>{assert.ok(!columnsOf('shared_people').some(c=>c.name==='extra'));const preview=regenerateShared('shared_people');assert.equal(preview.added[0].name,'extra');assert.throws(()=>regenerateShared('shared_people','bad'),/เปลี่ยน/);regenerateShared('shared_people',preview.token);assert.equal(columnsOf('shared_people')[0].label,'Local');assert.ok(columnsOf('shared_people').some(c=>c.name==='extra'));});
}));
test('source grant caps writes and revocation immediately removes access',()=>fixture((d,id,run)=>{
 run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:true,create:true,update:true,delete:false,export:false}}));run(id,()=>importSharedTable('shared_people'));
 let rights=applicationScopeFor(owner,id).datasets.shared_people;assert.equal(rights.update,true);assert.equal(rights.delete,false);
 run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:false,create:false,update:false,delete:false,export:false}}));rights=applicationScopeFor(owner,id).datasets.shared_people;assert.equal(rights.read,false);assert.equal(rights.update,false);
}));
test('writes use source validation and stale-schema guard, not a second write engine',()=>fixture((d,id,run)=>{
 run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:true,create:true,update:true,delete:false,export:false}}));
 d.prepare("UPDATE _columns SET required=1,valid_if='LEN([title]) >= 3' WHERE name='title'").run();run(id,()=>importSharedTable('shared_people'));
 run(id,()=>{const {writeColumns}=require('../.test-build/shared-table-columns');assert.equal(writeColumns(db,'shared_people')[0].valid_if,'LEN([title]) >= 3');const {writeRecord}=require('../.test-build/data-write');assert.throws(()=>writeRecord('shared_people',{title:'x'}));const saved=writeRecord('shared_people',{title:'Alice'});assert.ok(saved.id);});
 d.exec('ALTER TABLE t_shared_people ADD COLUMN extra TEXT');d.prepare("INSERT INTO _columns(table_name,name,label,type,pos) VALUES('shared_people','extra','Extra','text',2)").run();run(id,()=>assert.throws(()=>require('../.test-build/shared-table-columns').writeColumns(db,'shared_people'),/รีเจน/));
}));
test('shared overlay endpoint operations cannot alter physical fields or source virtuals',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));run(id,()=>{assert.throws(()=>saveSharedSettings('shared_people',{op:'virtual',column:{name:'title',type:'text',virtual_expr:'1'}}),/ซ้ำ/);assert.throws(()=>saveSharedSettings('shared_people',{op:'drop_virtual',name:'title'}),/ไม่พบ/);assert.throws(()=>importSharedTable('shared_people'),/เชื่อมอยู่แล้ว/);});assert.equal(d.prepare('SELECT count(*) n FROM _columns').get().n,2);
}));
test('clone materializes app-local virtuals/labels for a new database and preserves them for shared clone',()=>fixture((d,id,run)=>{
 run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:true,create:true,update:true,delete:false,export:true}}));run(id,()=>importSharedTable('shared_people'));
 run(id,()=>{saveSharedSettings('shared_people',{op:'column',name:'title',label:'Recipient title',is_label:true});saveSharedSettings('shared_people',{op:'virtual',column:{name:'local_formula',label:'Local formula',type:'text',virtual_expr:'CONCATENATE([title], " local")'}});});
 const {cloneApplication}=require('../.test-build/application-lifecycle');
 const copied=cloneApplication(owner,id,'Independent copy','new',false),name=copied.table_mapping.shared_people;
 run(copied.id,()=>{const cols=columnsOf(name);assert.equal(cols[0].label,'Recipient title');assert.ok(cols.some(c=>c.name==='local_formula'));assert.ok(!cols.some(c=>c.name==='upstream_calc'));});
 const shared=cloneApplication(owner,id,'Shared copy','shared',false);run(shared.id,()=>{assert.equal(columnsOf('shared_people')[0].label,'Recipient title');assert.ok(columnsOf('shared_people').some(c=>c.name==='local_formula'));});assert.equal(applicationScopeFor(owner,shared.id).datasets.shared_people.update,true);
}));
test('app backup materializes local metadata and whole-system backup validates overlay views',()=>fixture((d,id,run)=>{
 const fs=require('node:fs'),path=require('node:path'),root=fs.mkdtempSync(path.resolve('.test-data/shared-backup-'));
 try{
  run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:true,create:false,update:false,delete:false,export:true}}));run(id,()=>importSharedTable('shared_people'));
  run(id,()=>{saveSharedSettings('shared_people',{op:'virtual',column:{name:'local_formula',label:'Local formula',type:'text',virtual_expr:'CONCATENATE([title], " local")'}});db.prepare("UPDATE _views SET columns_json=? WHERE table_name='shared_people'").run('["title","local_formula"]');});
  const {exportApplicationBackup}=require('../.test-build/application-backups'),{inspectBackup}=require('../.test-build/backups');
  const appPath=path.join(root,'app.db');exportApplicationBackup(owner,id,appPath);const appDb=new Database(appPath);try{assert.ok(appDb.prepare("SELECT 1 FROM _columns WHERE name='local_formula'").get());assert.ok(!appDb.prepare("SELECT 1 FROM _columns WHERE name='upstream_calc'").get());assert.equal(appDb.prepare('SELECT count(*) n FROM _table_overlays').get().n,0);}finally{appDb.close();}
  const appStage=path.join(root,'app-stage.db');inspectBackup(appPath,appStage,undefined,true);
  const allPath=path.join(root,'all.db');d.prepare('VACUUM INTO ?').run(allPath);inspectBackup(allPath,path.join(root,'all-stage.db'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}));
test('malformed overlay identifiers from stored metadata fail closed',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));const {applicationTable}=require('../.test-build/application-context'),store=applicationTable(id,'_table_overlays');const original=d.prepare('SELECT config_json FROM "'+store+'"').get().config_json,value=JSON.parse(original);value.virtuals=[{name:'x"; DROP TABLE t_shared_people;--',type:'text',label:'Bad',is_virtual:true,virtual_expr:'1'}];d.prepare('UPDATE "'+store+'" SET config_json=?').run(JSON.stringify(value));run(id,()=>assert.throws(()=>columnsOf('shared_people')));assert.ok(d.prepare("SELECT 1 FROM sqlite_master WHERE name='t_shared_people'").get());
}));
test('source virtuals remain internal to write validation and cannot be shadowed by recipient formulas',()=>fixture((d,id,run)=>{
 d.prepare("UPDATE _columns SET valid_if=? WHERE name='title'").run('[upstream_calc] = CONCATENATE([title], " source")');
 run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:true,create:true,update:true,delete:false,export:false}}));run(id,()=>importSharedTable('shared_people'));
 run(id,()=>{assert.ok(!columnsOf('shared_people').some(c=>c.name==='upstream_calc'));assert.throws(()=>saveSharedSettings('shared_people',{op:'virtual',column:{name:'upstream_calc',label:'Shadow',type:'text',virtual_expr:'"fake"'}}),/ซ้ำ/);const {writeRecord}=require('../.test-build/data-write');assert.ok(writeRecord('shared_people',{title:'Alice',upstream_calc:'fake'}).id);});
}));
test('a duplicate import with an old request scope cannot overwrite local metadata',()=>fixture((d,id,run)=>{
 const staleScope=applicationScopeFor(owner,id);run(id,()=>importSharedTable('shared_people'));run(id,()=>saveSharedSettings('shared_people',{op:'column',name:'title',label:'Keep me',is_label:true}));
 withApplication(staleScope,()=>runAuthorized(owner,accessFor(owner),()=>assert.throws(()=>importSharedTable('shared_people'),/เชื่อมอยู่แล้ว/)));
 run(id,()=>assert.equal(columnsOf('shared_people')[0].label,'Keep me'));
}));
test('catalog shows the current source app name after a branding rename',()=>fixture((d,id,run)=>{
 d.prepare("UPDATE _app_settings SET name='Renamed source' WHERE id=1").run();run(id,()=>assert.equal(sharedCatalog().tables.find(t=>t.name==='shared_people').source_app,'Renamed source'));
}));
test('independent export refuses missing source-rule dependencies instead of producing a broken package',()=>fixture((d,id,run)=>{
 d.prepare("UPDATE _columns SET valid_if='[upstream_calc] <> \"\"' WHERE name='title'").run();run(id,()=>importSharedTable('shared_people'));
 assert.throws(()=>require('../.test-build/shared-table-export').exportedColumnRows(d,'shared_people',id),/กฎบันทึก/);
}));
test('local virtual removal cannot break a formula in another table of the recipient app',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));run(id,()=>saveSharedSettings('shared_people',{op:'virtual',column:{name:'local_formula',label:'Local',type:'text',virtual_expr:'[title]'}}));
 d.prepare("INSERT INTO _tables(name,label,owner_app_id) VALUES('local_dependent','Dependent',?)").run(id);d.exec("CREATE TABLE t_local_dependent(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT);INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('local_dependent','title','Title','text',0,NULL),('local_dependent','computed','Computed','text',1,'INDEX(shared_people[local_formula],1)')");
 run(id,()=>{assert.throws(()=>saveSharedSettings('shared_people',{op:'drop_virtual',name:'local_formula'}));assert.ok(columnsOf('shared_people').some(c=>c.name==='local_formula'));});
}));
function relatedSource(d,cycle=false){d.exec("INSERT INTO _tables(name,label,owner_app_id) VALUES('shared_orders','Orders','default');INSERT INTO _columns(table_name,name,label,type,pos) VALUES('shared_orders','title','Order title','text',0);INSERT INTO _columns(table_name,name,label,type,ref_table,pos) VALUES('shared_orders','person','Person','ref','shared_people',1);CREATE TABLE t_shared_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,person INTEGER REFERENCES t_shared_people(id))");if(cycle){d.exec("ALTER TABLE t_shared_people ADD COLUMN order_link INTEGER REFERENCES t_shared_orders(id);INSERT INTO _columns(table_name,name,label,type,ref_table,pos) VALUES('shared_people','order_link','Order','ref','shared_orders',2)");}createDefaultViews(d,'shared_orders','Orders');}
test('batch import resolves mutual Ref dependencies and deduplicates the selected tables',()=>fixture((d,id,run)=>{
 relatedSource(d,true);const {importSharedTables}=require('../.test-build/shared-tables');run(id,()=>{assert.throws(()=>importSharedTables(['shared_people']),/อ้างอิง/);assert.equal(d.prepare('SELECT count(*) n FROM _application_datasets WHERE app_id=?').get(id).n,0);const result=importSharedTables(['shared_orders','shared_people','shared_orders']);assert.equal(result.total,2);});
 assert.equal(d.prepare('SELECT count(*) n FROM _application_datasets WHERE app_id=?').get(id).n,2);assert.deepEqual(d.pragma('foreign_key_check'),[]);
}));
test('a batch failure rolls back earlier grants, overlays and generated Views',()=>fixture((d,id,run)=>{
 const {importSharedTables}=require('../.test-build/shared-tables'),{applicationTable}=require('../.test-build/application-context');run(id,()=>{assert.throws(()=>importSharedTables(['shared_people','zz_missing']));assert.throws(()=>importSharedTables(Array(51).fill('shared_people')),/50/);assert.throws(()=>importSharedTables([]));});
 for(const table of ['_application_datasets','_table_shares'])assert.equal(d.prepare('SELECT count(*) n FROM '+table).get().n,0);for(const table of ['_table_overlays','_views'])assert.equal(d.prepare('SELECT count(*) n FROM "'+applicationTable(id,table)+'"').get().n,0);
}));
test('disconnect preview is read-only, requires a current token and removes only recipient config',()=>fixture((d,id,run)=>{
 const {previewSharedDisconnect,disconnectSharedTables}=require('../.test-build/shared-table-disconnect'),{applicationTable}=require('../.test-build/application-context');d.prepare('INSERT INTO t_shared_people(title) VALUES(?)').run('Alice');run(id,()=>importSharedTable('shared_people'));const originalViews=d.prepare('SELECT * FROM _views ORDER BY name').all();
 run(id,()=>{saveSharedSettings('shared_people',{op:'virtual',column:{name:'local_formula',label:'Local',type:'text',virtual_expr:'[title]'}});const before=d.prepare('SELECT count(*) n FROM _audit_log').get().n,preview=previewSharedDisconnect(['shared_people']);assert.equal(preview.allowed,true);assert.equal(preview.virtuals.length,1);assert.equal(preview.removed.find(r=>r.kind==='View').items.length,3);assert.equal(d.prepare('SELECT count(*) n FROM _audit_log').get().n,before);assert.ok(tableExistsInRecipient());
  saveSharedSettings('shared_people',{op:'label',label:'Changed'});assert.throws(()=>disconnectSharedTables(['shared_people'],preview.token,'ยกเลิกเชื่อมต่อ'),/เปลี่ยน/);const current=previewSharedDisconnect(['shared_people']);assert.throws(()=>disconnectSharedTables(['shared_people'],current.token,'wrong'),/ยืนยัน/);disconnectSharedTables(['shared_people'],current.token,'ยกเลิกเชื่อมต่อ');
 });
 function tableExistsInRecipient(){return !!d.prepare('SELECT 1 FROM _application_datasets WHERE app_id=?').get(id);}
 assert.equal(d.prepare('SELECT title FROM t_shared_people').get().title,'Alice');assert.deepEqual(d.prepare('SELECT * FROM _views ORDER BY name').all(),originalViews);assert.equal(d.prepare('SELECT count(*) n FROM "'+applicationTable(id,'_table_overlays')+'"').get().n,0);assert.equal(applicationScopeFor(owner,id).datasets.shared_people,undefined);assert.ok(d.prepare('SELECT 1 FROM _table_shares WHERE target_app_id=?').get(id));run(id,()=>importSharedTable('shared_people'));
}));
test('disconnect blocks remaining Ref dependencies but allows unlinking an entire cycle',()=>fixture((d,id,run)=>{
 relatedSource(d,true);const {importSharedTables}=require('../.test-build/shared-tables'),{previewSharedDisconnect,disconnectSharedTables}=require('../.test-build/shared-table-disconnect');run(id,()=>importSharedTables(['shared_people','shared_orders']));run(id,()=>{const one=previewSharedDisconnect(['shared_people']);assert.equal(one.allowed,false);assert.ok(one.blockers.some(b=>/อ้างอิง/.test(b.message)));assert.throws(()=>disconnectSharedTables(['shared_people'],one.token,'ยกเลิกเชื่อมต่อ'));const both=previewSharedDisconnect(['shared_people','shared_orders']);assert.equal(both.allowed,true,JSON.stringify(both.blockers));disconnectSharedTables(both.tables,both.token,'ยกเลิกเชื่อมต่อ');});assert.equal(d.prepare('SELECT count(*) n FROM _application_datasets WHERE app_id=?').get(id).n,0);assert.ok(d.prepare("SELECT 1 FROM sqlite_master WHERE name='t_shared_people'").get());assert.ok(d.prepare("SELECT 1 FROM sqlite_master WHERE name='t_shared_orders'").get());
}));
test('revoked links can still be disconnected without granting read access back',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:false,create:false,update:false,delete:false,export:false}}));run(id,()=>{const row=sharedCatalog().tables.find(t=>t.name==='shared_people');assert.equal(row.connected,true);assert.equal(row.readable,false);const {previewSharedDisconnect,disconnectSharedTables}=require('../.test-build/shared-table-disconnect'),impact=previewSharedDisconnect(['shared_people']);assert.equal(impact.allowed,true);disconnectSharedTables(['shared_people'],impact.token,'ยกเลิกเชื่อมต่อ');});assert.equal(applicationScopeFor(owner,id).datasets.shared_people,undefined);
}));
test('disconnect refuses owned tables and queued Automation jobs',()=>fixture((d,id,run)=>{
 const {previewSharedDisconnect}=require('../.test-build/shared-table-disconnect');run('default',()=>assert.throws(()=>previewSharedDisconnect(['shared_people']),/เชื่อม/));run(id,()=>importSharedTable('shared_people'));const {applicationTable}=require('../.test-build/application-context');d.prepare('INSERT INTO "'+applicationTable(id,'_automation_jobs')+'"(id,automation_name,label,table_name,row_id,actor_id,event,status,created_at,updated_at,config_json,row_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('queued-fixture','job','Queued job','shared_people',1,1,'manual','queued',1,1,'{}','{}');run(id,()=>{const impact=previewSharedDisconnect(['shared_people']);assert.equal(impact.allowed,false);assert.ok(impact.blockers.some(b=>b.kind==='job'));});assert.ok(d.prepare('SELECT 1 FROM _application_datasets WHERE app_id=?').get(id));
}));
test('disconnect protects notification/header View references and other app Builders',()=>fixture((d,id,run)=>{
 const {previewSharedDisconnect}=require('../.test-build/shared-table-disconnect'),{applicationTable}=require('../.test-build/application-context');run(id,()=>importSharedTable('shared_people'));
 const settings=applicationTable(id,'_app_settings'),header=JSON.parse(d.prepare('SELECT header_json FROM "'+settings+'"').get().header_json),view=d.prepare('SELECT name FROM "'+applicationTable(id,'_views')+'" WHERE kind=\'list\'').get().name;d.prepare('UPDATE "'+settings+'" SET header_json=?').run(JSON.stringify({...header,notifications_view:view}));
 run(id,()=>{const preview=previewSharedDisconnect(['shared_people']);assert.equal(preview.allowed,false);assert.ok(preview.blockers.some(b=>b.kind==='settings'));});
 withApplication(applicationScopeFor(owner,id),()=>runAuthorized({id:42,name:'No management',email:'fixture42@example.test',role:'unknown'},{owner:false,builder:true,tables:{},actions:[]},()=>assert.throws(()=>previewSharedDisconnect(['shared_people']))));
}));
test('disconnect protects queued snapshots that reference a removed Action from another table',()=>fixture((d,id,run)=>{
 const {previewSharedDisconnect}=require('../.test-build/shared-table-disconnect'),{applicationTable}=require('../.test-build/application-context');run(id,()=>importSharedTable('shared_people'));const actionTable=applicationTable(id,'_actions'),jobs=applicationTable(id,'_automation_jobs');d.prepare('INSERT INTO "'+actionTable+'"(name,label,table_name,kind,values_json) VALUES(?,?,?,?,?)').run('linked_action','Linked action','shared_people','set','{}');d.prepare('INSERT INTO "'+jobs+'"(id,automation_name,label,table_name,row_id,actor_id,event,status,created_at,updated_at,config_json,row_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('cross-job','archived_workflow','Queued cross-table job','other_table',1,1,'manual','queued',1,1,JSON.stringify({steps:[{kind:'action',action_name:'linked_action'}]}),'{}');run(id,()=>{const preview=previewSharedDisconnect(['shared_people']);assert.equal(preview.allowed,false);assert.ok(preview.blockers.some(b=>b.kind==='job'));});
}));
test('revoked connection cleanup does not expose new source columns to the recipient Builder',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));const source=createApplication('Private owner','');d.prepare("UPDATE _tables SET owner_app_id=? WHERE name='shared_people'").run(source.id);run(source.id,()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:false,create:false,update:false,delete:false,export:false}}));d.exec("ALTER TABLE t_shared_people ADD COLUMN after_revocation TEXT;INSERT INTO _columns(table_name,name,label,type) VALUES('shared_people','after_revocation','Private new column','text');INSERT INTO _roles(name,label,builder) VALUES('scoped_builder','Scoped builder',1)");d.prepare('INSERT INTO _application_roles(app_id,role_name,can_use,builder) VALUES(?,?,1,1)').run(id,'scoped_builder');const builder={id:42,name:'Builder fixture',email:'fixture42@example.test',role:'scoped_builder'};withApplication(applicationScopeFor(builder,id),()=>runAuthorized(builder,accessFor(builder),()=>{const table=sharedCatalog().tables.find(t=>t.name==='shared_people');assert.equal(table.connected,true);assert.equal(table.readable,false);assert.ok(!table.columns.some(c=>c.name==='after_revocation'));}));
}));
test('legacy platform unlink cannot orphan managed overlays by bypassing the impact dialog',()=>fixture((d,id,run)=>{
 const {setApplicationDataset}=require('../.test-build/applications'),{applicationTable}=require('../.test-build/application-context');run(id,()=>importSharedTable('shared_people'));d.prepare('DELETE FROM "'+applicationTable(id,'_views')+'"').run();assert.throws(()=>setApplicationDataset(id,'shared_people',null,true),/ตรวจผลกระทบ/);assert.ok(d.prepare('SELECT 1 FROM _application_datasets WHERE app_id=?').get(id));assert.ok(d.prepare('SELECT 1 FROM "'+applicationTable(id,'_table_overlays')+'"').get());
}));
test('explicit source revocation cannot become a successful but unreadable re-import',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));run('default',()=>shareTable({table:'shared_people',target_app_id:id,rights:{read:false,create:false,update:false,delete:false,export:false}}));const {previewSharedDisconnect,disconnectSharedTables}=require('../.test-build/shared-table-disconnect');run(id,()=>{const impact=previewSharedDisconnect(['shared_people']);disconnectSharedTables(['shared_people'],impact.token,'ยกเลิกเชื่อมต่อ');});run(id,()=>assert.throws(()=>importSharedTable('shared_people'),/ระงับ/));assert.equal(d.prepare('SELECT count(*) n FROM _application_datasets WHERE app_id=?').get(id).n,0);
}));

test('central dataset permissions update imported table source caps atomically',()=>fixture((d,id,run)=>{
 run(id,()=>importSharedTable('shared_people'));
 const {setApplicationDataset}=require('../.test-build/applications');
 setApplicationDataset(id,'shared_people',{read:true,create:true,update:true,delete:false,export:false});
 const scope=applicationScopeFor(owner,id);assert.equal(scope.datasets.shared_people.create,true);assert.equal(scope.datasets.shared_people.update,true);
 assert.equal(d.prepare('SELECT can_create FROM _table_shares WHERE table_name=? AND target_app_id=?').get('shared_people',id).can_create,1);
 setApplicationDataset(id,'shared_people',{read:true,create:false,update:false,delete:false,export:false});assert.equal(applicationScopeFor(owner,id).datasets.shared_people.create,false);
}));

test('new central read grant creates managed shared metadata without source virtuals',()=>fixture((d,id,run)=>{
 const {setApplicationDataset}=require('../.test-build/applications');setApplicationDataset(id,'shared_people',{read:true,create:false,update:false,delete:false,export:false});
 const {tableOverlay}=require('../.test-build/shared-table-columns');assert.ok(tableOverlay(d,'shared_people',id));run(id,()=>assert.deepEqual(columnsOf('shared_people').map(c=>c.name),['title']));
}));

test('explicit central save upgrades legacy link without losing its existing virtuals',()=>fixture((d,id,run)=>{
 d.prepare('INSERT INTO _application_datasets(app_id,table_name,can_read) VALUES(?,?,1)').run(id,'shared_people');
 const {setApplicationDataset}=require('../.test-build/applications');setApplicationDataset(id,'shared_people',{read:true,create:false,update:false,delete:false,export:false});
 run(id,()=>{assert.ok(columnsOf('shared_people').some(c=>c.name==='upstream_calc'));saveSharedSettings('shared_people',{op:'virtual',original:'upstream_calc',column:{name:'upstream_calc',label:'Local retained formula',type:'text',virtual_expr:'"Local"'}});assert.equal(columnsOf('shared_people').find(c=>c.name==='upstream_calc').virtual_expr,'"Local"');});
 assert.equal(d.prepare('SELECT is_virtual FROM _columns WHERE name=?').get('upstream_calc').is_virtual,1);
}));
