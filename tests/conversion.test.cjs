const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {initializeDatabase,columnDefinition,createDefaultViews}=require('../.test-build/schema.js');
const {convertValue,previewConversion,applyConversion,conversionFingerprint}=require('../.test-build/column-conversion.js');
const {FORMULA_FIELDS}=require('../.test-build/columns.js');
const fs=require('node:fs'),path=require('node:path');
function table(db,name,columns,rows=[]){db.prepare('INSERT INTO _tables(name,label) VALUES(?,?)').run(name,name);for(const [pos,c] of columns.entries()){
 const fields=['table_name','name','label','type','options','ref_table','required','pos','is_virtual','is_key','is_label',...FORMULA_FIELDS],value={is_virtual:0,is_key:0,is_label:0,required:0,...c,table_name:name,label:c.label||c.name,pos};db.prepare(`INSERT INTO _columns(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>value[k]??null));}
 db.exec(`CREATE TABLE "t_${name}"(id INTEGER PRIMARY KEY AUTOINCREMENT,${columns.filter(c=>!c.is_virtual).map(columnDefinition).join(',')})`);for(const row of rows){const keys=Object.keys(row);db.prepare(`INSERT INTO "t_${name}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));}createDefaultViews(db,name,name);
}
const fixture=()=>{const db=new Database(':memory:');initializeDatabase(db,':memory:');return db;};
const text={name:'value',label:'ค่า',type:'text'},target=type=>({...text,type});
test('EnumList option edits check every selected value and retain the saved selections',()=>{
 const db=fixture();
 try {
  const selection='["Waiting","Done"]';
  table(db,'statuses',[{...text,type:'enumlist',options:'Waiting,Done'}],[{value:selection}]);
  const request=options=>({column:'value',mode:'replace',target:{type:'enumlist',options}});
  const blocked=previewConversion(db,'statuses',request('Waiting,Working'));
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.failed,1);
  const next=request('Waiting,Working,Done');
  assert.equal(previewConversion(db,'statuses',next).allowed,true);
  applyConversion(db,'statuses',next);
  assert.equal(db.prepare("SELECT options FROM _columns WHERE table_name='statuses' AND name='value'").get().options,'Waiting,Working,Done');
  assert.equal(db.prepare('SELECT value FROM t_statuses').get().value,selection);
 }finally{db.close();}
});
test('Enum option edits preview existing rows before replacing the option list',()=>{
 const db=fixture();
 try {
  table(db,'statuses',[{...text,type:'enum',options:'Waiting,Done'}],[{value:'Waiting'}]);
  const request=options=>({column:'value',mode:'replace',target:{type:'enum',options}});
  assert.equal(previewConversion(db,'statuses',request('Done')).allowed,false);
  const next=request('Waiting,Working,Done');
  const report=previewConversion(db,'statuses',next);
  assert.equal(report.allowed,true,JSON.stringify(report));
  assert.equal(db.prepare("SELECT options FROM _columns WHERE table_name='statuses' AND name='value'").get().options,'Waiting,Done');
  applyConversion(db,'statuses',next);
  assert.equal(db.prepare("SELECT options FROM _columns WHERE table_name='statuses' AND name='value'").get().options,'Waiting,Working,Done');
  assert.equal(db.prepare('SELECT value FROM t_statuses').get().value,'Waiting');
 }finally{db.close();}
});
test('app-scoped TEXT to EnumList preview ignores unrelated inaccessible tables without reading their data',()=>{
 const d=fixture(),{withDatabase,db}=require('../.test-build/db'),{withApplication}=require('../.test-build/application-context'),{runAuthorized,accessFor}=require('../.test-build/permissions');
 try{table(d,'inspection_groups',[text]);table(d,'unrelated_private',[text],[{value:'private fixture'}]);const owner={id:1,name:'Owner',email:'owner@example.test',role:'owner'};withDatabase(d,()=>withApplication({id:'default',datasets:{inspection_groups:{read:true,create:true,update:true,delete:true}}},()=>runAuthorized(owner,accessFor(owner),()=>{
  const before=conversionFingerprint(db,'inspection_groups',{column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}}),report=previewConversion(db,'inspection_groups',{column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}});assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.total,0);assert.equal(report.failed,0);assert.equal(conversionFingerprint(db,'inspection_groups',{column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}}),before);assert.throws(()=>db.prepare('SELECT * FROM t_unrelated_private').all(),/ไม่ได้เชื่อม/);
 })));}finally{d.close();}
});
test('named app conversion validates its own metadata, preserves other apps and converts existing TEXT rows',()=>{
 const d=fixture(),{withDatabase,db,applicationDatabase}=require('../.test-build/db'),{withApplication}=require('../.test-build/application-context'),{createApplicationConfig}=require('../.test-build/application-schema'),{runAuthorized,accessFor}=require('../.test-build/permissions'),app='a_'+'2'.repeat(24);
 try{table(d,'scoped_groups',[text],[{value:'A'},{value:'B'}]);table(d,'private_other',[text],[{value:'private fixture'}]);d.prepare('INSERT INTO _applications(id,label,description,created_at) VALUES(?,?,?,0)').run(app,'Test app','');createApplicationConfig(d,app);d.prepare("UPDATE _tables SET owner_app_id=? WHERE name='scoped_groups'").run(app);createDefaultViews(applicationDatabase(d,app),'scoped_groups','Groups');d.exec("UPDATE _views SET display_json='{\"table_density\":\"invalid\"}'");const owner={id:1,name:'Owner',email:'owner@example.test',role:'owner'},request={column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}};
 withDatabase(d,()=>withApplication({id:app,datasets:{scoped_groups:{read:true,create:true,update:true,delete:true}}},()=>runAuthorized(owner,accessFor(owner),()=>{const before=conversionFingerprint(db,'scoped_groups',request),report=previewConversion(db,'scoped_groups',request);assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.converted,2);assert.equal(d.prepare('SELECT value FROM t_scoped_groups WHERE id=1').get().value,'A');applyConversion(db,'scoped_groups',request,before);assert.deepEqual(d.prepare('SELECT value FROM t_scoped_groups ORDER BY id').all().map(r=>JSON.parse(r.value)),[['A'],['B']]);assert.throws(()=>db.prepare('SELECT * FROM t_private_other').all(),/ไม่ได้เชื่อม/);})));assert.equal(d.prepare('SELECT value FROM t_private_other').get().value,'private fixture');assert.equal(JSON.parse(d.prepare('SELECT display_json FROM _views LIMIT 1').get().display_json).table_density,'invalid');
 }finally{d.close();}
});
test('conversion fails closed for an out-of-app dependency without exposing its name, rows or granting access',()=>{
 const d=fixture(),{withDatabase,db}=require('../.test-build/db'),{withApplication}=require('../.test-build/application-context'),{runAuthorized,accessFor}=require('../.test-build/permissions');try{table(d,'groups',[text],[{value:'A'}]);table(d,'secret_child',[{name:'parent',type:'ref',ref_table:'groups'}],[{parent:1}]);const owner={id:1,name:'Owner',email:'owner@example.test',role:'owner'};withDatabase(d,()=>withApplication({id:'default',datasets:{groups:{read:true,create:true,update:true,delete:true}}},()=>runAuthorized(owner,accessFor(owner),()=>{const report=previewConversion(db,'groups',{column:'value',mode:'replace',target:{type:'enumlist',options:'A'}});assert.equal(report.allowed,false);assert.match(report.issues[0].message,/นอกแอป/);assert.ok(!JSON.stringify(report).includes('secret_child'));assert.throws(()=>db.prepare('SELECT * FROM t_secret_child').all(),/ไม่ได้เชื่อม/);assert.equal(d.prepare('SELECT value FROM t_groups').get().value,'A');})));}finally{d.close();}
});
test('explicit conversions preserve precision and list members; support Thai booleans and calendar values',()=>{
 assert.equal(convertValue(text,target('decimal'),' 0012.50 '),12.5);assert.equal(convertValue(text,target('decimal'),'1e-3'),.001);
 for(const value of ['12,500','5oops','0xFF','Infinity','9007199254740993','0.12345678901234567890','1e-999'])assert.throws(()=>convertValue(text,target('decimal'),value));
 assert.equal(convertValue(text,target('yesno'),'ใช่'),1);assert.equal(convertValue(text,target('yesno'),'ไม่ใช่'),0);assert.throws(()=>convertValue(text,target('yesno'),'maybe'));
 assert.deepEqual(convertValue(text,{...target('enumlist'),options:'red,blue'},'red'),['red']);assert.deepEqual(convertValue(text,{...target('enumlist'),options:'red,blue'},'["red","blue"]'),['red','blue']);
 assert.throws(()=>convertValue(target('list'),target('number'),'["1","2"]'),/หลายรายการ/);assert.equal(convertValue(target('list'),text,'["1","2"]'),'["1","2"]');
 assert.equal(convertValue(target('date'),target('datetime'),'2026-10-06'),'2026-10-06T00:00:00.000+07:00');assert.equal(convertValue(target('datetime'),target('date'),'2026-10-05T18:30Z'),'2026-10-06');assert.throws(()=>convertValue(text,target('date'),'2026-02-30'));
});
test('preview is read-only; conversion preserves IDs, foreign keys, formulas and AUTOINCREMENT history',()=>{
 const db=fixture();try{table(db,'items',[{name:'title',type:'text',is_label:1},text,{name:'double',type:'number',is_virtual:1,virtual_expr:'[value] * 2'}],[{id:1,title:'หนึ่ง',value:'12.50'},{id:80,title:'ลบ',value:'1'}]);db.prepare('DELETE FROM t_items WHERE id=80').run();table(db,'orders',[{name:'item',type:'ref',ref_table:'items'}],[{item:1}]);
 const request={column:'value',mode:'replace',target:{type:'decimal'}},fingerprint=conversionFingerprint(db),report=previewConversion(db,'items',request);assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.samples[0].after,'12.5');assert.equal(conversionFingerprint(db),fingerprint);assert.equal(db.prepare('SELECT value FROM t_items').get().value,'12.50');
 applyConversion(db,'items',request);assert.equal(db.prepare('SELECT value FROM t_items').get().value,12.5);assert.equal(db.prepare("SELECT type FROM _columns WHERE table_name='items' AND name='value'").get().type,'decimal');assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(Number(db.prepare("INSERT INTO t_items(title,value) VALUES('ใหม่',2)").run().lastInsertRowid),81);assert.throws(()=>db.prepare('DELETE FROM t_items WHERE id=1').run(),/FOREIGN KEY/);
 }finally{db.close();}
});
test('invalid data, duplicate converted keys, incompatible views and cross-table formulas prevent conversion',()=>{
 const db=fixture();try{table(db,'items',[text],[{value:'bad'},{value:'3'}]);let report=previewConversion(db,'items',{column:'value',mode:'replace',target:{type:'decimal'}});assert.equal(report.allowed,false);assert.equal(report.failed,1);assert.equal(report.issues[0].id,1);assert.equal(db.prepare('SELECT value FROM t_items WHERE id=1').get().value,'bad');
 db.prepare("UPDATE t_items SET value=CASE id WHEN 1 THEN '01' ELSE '1' END").run();db.prepare("UPDATE _columns SET is_key=1 WHERE name='value'").run();report=previewConversion(db,'items',{column:'value',mode:'replace',target:{type:'number'}});assert.equal(report.allowed,false);assert.match(report.issues[0].message,/Key/);
 db.prepare("UPDATE _columns SET is_key=0 WHERE name='value'").run();db.prepare("UPDATE _views SET display_json=? WHERE kind='form'").run(JSON.stringify({form_fields:{value:{multiline:true}}}));report=previewConversion(db,'items',{column:'value',mode:'replace',target:{type:'decimal'}});assert.equal(report.allowed,false);assert.ok(report.issues.some(i=>i.table.startsWith('View')));
 }finally{db.close();}
});
test('copy retains original data and configuration; Ref matches real Key and generates Inline',()=>{
 const db=fixture();try{table(db,'products',[{name:'code',type:'text',is_key:1},{name:'title',type:'text',is_label:1}],[{id:4,code:'P1',title:'สินค้า'}]);table(db,'items',[text],[{value:'P1'}]);
 const request={column:'value',mode:'copy',target:{name:'product',label:'สินค้า',type:'ref',ref_table:'products'},ref_match:'key'},report=previewConversion(db,'items',request);assert.equal(report.allowed,true,JSON.stringify(report));applyConversion(db,'items',request);assert.deepEqual(db.prepare('SELECT value,product FROM t_items').get(),{value:'P1',product:4});assert.equal(db.prepare("SELECT COUNT(*) AS n FROM _views WHERE position='inline' AND inline_ref='product'").get().n,1);
 const invalid=previewConversion(db,'items',{...request,target:{...request.target,name:'other'},ref_match:'id'});assert.equal(invalid.allowed,false);assert.match(invalid.issues[0].message,/ไม่พบรหัส/);
 assert.throws(()=>previewConversion(db,'items',{...request,target:{...request.target,name:'bad";--'}}),/ชื่อในระบบ/);
 }finally{db.close();}
});
test('date-only conversion reports lost time; changing business-key type preserves List ids',()=>{
 const db=fixture();try{table(db,'events',[{name:'at',type:'datetime'}],[{at:'2026-10-06T09:15:00.000+07:00'}]);const report=previewConversion(db,'events',{column:'at',mode:'replace',target:{type:'date'}});assert.equal(report.allowed,true,JSON.stringify(report));assert.match(report.warnings[0],/เวลา/);
 table(db,'keys',[{...text,is_key:1}],[{value:'001'}]);table(db,'lists',[{name:'items',type:'list',ref_table:'keys'}],[{items:'["1"]'}]);const keys=previewConversion(db,'keys',{column:'value',mode:'replace',target:{type:'decimal'}});assert.equal(keys.allowed,true,JSON.stringify(keys));applyConversion(db,'keys',{column:'value',mode:'replace',target:{type:'decimal'}});assert.equal(db.prepare('SELECT items FROM t_lists').get().items,'["1"]');
 }finally{db.close();}
});
test('cross-table dereferences are checked against the destination Ref schema',()=>{
 const db=fixture();try{table(db,'products',[{name:'title',type:'text'},{name:'price',type:'decimal'}],[{title:'สินค้า',price:10}]);table(db,'orders',[{name:'product',type:'ref',ref_table:'products'},{name:'cost',type:'decimal',is_virtual:1,virtual_expr:'[product].[price]'}],[{product:1}]);table(db,'other',[{name:'note',type:'text'},{name:'computed',type:'number',is_virtual:1,virtual_expr:'SUM(orders[cost])'}],[{note:'หนึ่ง'}]);
 // A valid dereference becomes invalid if product loses its Ref type.
 const fingerprint=conversionFingerprint(db),report=previewConversion(db,'orders',{column:'product',mode:'replace',target:{type:'text'}});assert.equal(report.allowed,false);assert.equal(conversionFingerprint(db),fingerprint);
 }finally{db.close();}
});
test('preview handles committed WAL rows without touching the live database journal or data',()=>{
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','conversion-wal-')),file=path.join(folder,'data.db'),db=new Database(file);
 try{initializeDatabase(db,':memory:');db.pragma('journal_mode=WAL');table(db,'items',[text],[{value:'12.50'}]);const fingerprint=conversionFingerprint(db);assert.ok(fs.statSync(file+'-wal').size>0);const report=previewConversion(db,'items',{column:'value',mode:'replace',target:{type:'decimal'}});assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.samples[0].after,'12.5');assert.equal(conversionFingerprint(db),fingerprint);assert.equal(db.pragma('journal_mode',{simple:true}),'wal');assert.equal(db.prepare('SELECT value FROM t_items').get().value,'12.50');
 }finally{db.close();}
});
test('data changed before entering the write transaction cannot be converted using an old preview',()=>{
 const db=fixture();try{table(db,'items',[text],[{value:'1'}]);const request={column:'value',mode:'replace',target:{type:'decimal'}},fingerprint=conversionFingerprint(db,'items',request);assert.equal(previewConversion(db,'items',request).allowed,true);db.prepare("UPDATE t_items SET value='2'").run();assert.throws(()=>applyConversion(db,'items',request,fingerprint),/ข้อมูลเปลี่ยน/);assert.equal(db.prepare('SELECT value FROM t_items').get().value,'2');assert.equal(db.prepare("SELECT type FROM _columns WHERE name='value'").get().type,'text');assert.equal(db.pragma('foreign_keys',{simple:true}),1);
 }finally{db.close();}
});

test('audited databases allow empty Image to Signature conversion without auditing previews',()=>{
 const {installAuditing}=require('../.test-build/audit-schema.js');
 const {withAuditActor}=require('../.test-build/audit-context.js');
 const db=fixture();try{
 table(db,'inspection',[{name:'title',type:'text',is_label:1},{name:'driver_signature',type:'image'}],[{id:3,title:'สาม',driver_signature:null},{id:4,title:'สี่',driver_signature:null}]);
 installAuditing(db);
 withAuditActor({id:1,name:'Owner',email:'owner@example.com',role:'owner'},'conversion-test',()=>{
 const request={column:'driver_signature',mode:'replace',target:{type:'signature'}},fingerprint=conversionFingerprint(db,'inspection',request);
 const report=previewConversion(db,'inspection',request);
 assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.converted,2);
 assert.equal(conversionFingerprint(db,'inspection',request),fingerprint);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _audit_log').get().n,0);
 applyConversion(db,'inspection',request,fingerprint);
 assert.deepEqual(db.prepare('SELECT id,driver_signature FROM t_inspection ORDER BY id').all(),[{id:3,driver_signature:null},{id:4,driver_signature:null}]);
 assert.equal(db.prepare("SELECT type FROM _columns WHERE name='driver_signature'").get().type,'signature');
 assert.ok(db.prepare('SELECT COUNT(*) AS n FROM _audit_log').get().n>0);
 });
 }finally{db.close();}
});

 test('conversion fingerprints ignore background writes but detect source and Ref mapping changes',()=>{const db=fixture();try{table(db,'items',[text],[{value:'12'}]);table(db,'unrelated',[text],[{value:'old'}]);const request={column:'value',mode:'replace',target:{type:'decimal'}},before=conversionFingerprint(db,'items',request);db.prepare("UPDATE t_unrelated SET value='new'").run();db.exec("CREATE TABLE background_noise(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO background_noise VALUES(1,'noise')");assert.equal(conversionFingerprint(db,'items',request),before);assert.equal(previewConversion(db,'items',request).allowed,true);applyConversion(db,'items',request,before);assert.equal(db.prepare('SELECT value FROM t_items').get().value,12);const refRequest={column:'value',mode:'replace',target:{type:'ref',ref_table:'unrelated'}};const refBefore=conversionFingerprint(db,'items',refRequest);db.prepare("UPDATE t_unrelated SET value='changed mapping'").run();assert.notEqual(conversionFingerprint(db,'items',refRequest),refBefore);}finally{db.close();}});


test('empty internal table converts despite a canonical Builder external-source SQL view',()=>{
 const db=fixture();try{
  table(db,'empty_local',[text]);table(db,'remote_cache',[text]);
  db.exec('DROP TABLE t_remote_cache');
  db.prepare("UPDATE _tables SET source_kind='EXTERNAL_REST_API',source_id=? WHERE name='remote_cache'").run('a'.repeat(32));
  require('../.test-build/external-storage').createExternalReadView(db,'remote_cache',[text],'a'.repeat(32));
  const sql=db.prepare("SELECT sql FROM sqlite_master WHERE name='t_remote_cache'").get().sql;
  const request={column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}};
  const report=previewConversion(db,'empty_local',request);assert.equal(report.allowed,true,JSON.stringify(report));assert.equal(report.total,0);
  applyConversion(db,'empty_local',request);assert.equal(db.prepare("SELECT type FROM _columns WHERE table_name='empty_local' AND name='value'").get().type,'enumlist');
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name='t_remote_cache'").get().sql,sql);
 }finally{db.close();}
});

test('conversion continues protecting custom SQL views, modified managed views, triggers and indexes',()=>{
 for(const kind of ['view','modified-view','trigger','index']){const db=fixture();try{
  table(db,'empty_local',[text]);
  if(kind==='view')db.exec('CREATE VIEW custom_view AS SELECT * FROM t_empty_local');
  if(kind==='modified-view'){table(db,'remote_cache',[text]);db.exec('DROP TABLE t_remote_cache');db.prepare("UPDATE _tables SET source_kind='EXTERNAL_REST_API',source_id=? WHERE name='remote_cache'").run('a'.repeat(32));db.exec('CREATE VIEW t_remote_cache AS SELECT * FROM t_empty_local');}
  if(kind==='trigger')db.exec('CREATE TRIGGER custom_trigger AFTER INSERT ON t_empty_local BEGIN SELECT 1; END');
  if(kind==='index')db.exec('CREATE INDEX custom_index ON t_empty_local(value)');
  const request={column:'value',mode:'replace',target:{type:'enumlist',options:'A,B'}};
  const before=db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all();
  assert.throws(()=>previewConversion(db,'empty_local',request),/SQL View/,kind);
  assert.throws(()=>applyConversion(db,'empty_local',request));assert.deepEqual(db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),before);
 }finally{db.close();}}
});

test('COLOR to Enum skips optional empty formulas in unrelated private table metadata',()=>{
 const d=fixture(),{withDatabase,db}=require('../.test-build/db'),{withApplication}=require('../.test-build/application-context'),{runAuthorized,accessFor}=require('../.test-build/permissions');try{
 table(d,'source_colors',[{name:'color',label:'Color',type:'color'}],[{color:'#112233'}]);table(d,'private_blank_formulas',[{...text,...Object.fromEntries(FORMULA_FIELDS.map(f=>[f,'   ']))}],[{value:'private row'}]);
 const owner={id:1,name:'Owner',email:'owner@example.test',role:'owner'};withDatabase(d,()=>withApplication({id:'default',datasets:{source_colors:{read:true,create:true,update:true,delete:true}}},()=>runAuthorized(owner,accessFor(owner),()=>{
 const request={column:'color',mode:'replace',target:{type:'enum',options:'#112233,#445566'}},before=conversionFingerprint(db,'source_colors',request),report=previewConversion(db,'source_colors',request);assert.equal(report.allowed,true,JSON.stringify(report.issues));assert.equal(report.failed,0);assert.equal(report.converted,1);assert.equal(conversionFingerprint(db,'source_colors',request),before);assert.throws(()=>db.prepare('SELECT * FROM t_private_blank_formulas').all(),/ไม่ได้เชื่อม/);
 })));}finally{d.close();}
});

test('conversion evaluates Slice and Action Related expressions in their owner table context',()=>{
 for(const explicit of [false,true]){const d=fixture();try{
  table(d,'cars',[text],[{value:'A'}]);table(d,'drivers',[text],[{value:'D'}]);
  table(d,'inspection',[{name:'car',type:'ref',ref_table:'cars'},{name:'driver',type:'ref',ref_table:'drivers'},{name:'inspection_type',type:'number'},{name:'created_at',type:'datetime'}],[{car:1,driver:1,inspection_type:1,created_at:'2026-11-19T10:00:00'}]);
  const related=explicit?'[Related_inspection:car][id]':'[Related_inspection][id]';
  const expression=`ISNOTBLANK(INDEX(ORDERBY(SELECT(${related},OR([inspection_type]=1,[inspection_type]=4)),[created_at],TRUE),1))`;
  d.prepare('INSERT INTO _slices(name,label,table_name,filter_expr) VALUES(?,?,?,?)').run('checked','Checked cars','cars',expression);
  d.prepare("INSERT INTO _actions(name,label,table_name,kind,condition_expr) VALUES('check_car','Check car','cars','set',?)").run(expression);
  const request={column:'value',mode:'replace',target:{type:'enum',options:'A'}};
  const report=previewConversion(d,'cars',request);assert.equal(report.allowed,true,JSON.stringify(report.issues));assert.equal(report.failed,0);
  applyConversion(d,'cars',request,conversionFingerprint(d,'cars',request));assert.equal(d.prepare('SELECT value FROM t_cars WHERE id=1').get().value,'A');
 }finally{d.close();}}
});

test('conversion still rejects genuinely ambiguous Related links to the same parent',()=>{
 const d=fixture();try{table(d,'cars',[text],[{value:'A'}]);table(d,'inspection',[{name:'car',type:'ref',ref_table:'cars'},{name:'other_car',type:'ref',ref_table:'cars'}],[{car:1,other_car:1}]);
 d.prepare('INSERT INTO _slices(name,label,table_name,filter_expr) VALUES(?,?,?,?)').run('checked','Checked cars','cars','COUNT([Related_inspection][id])>0');
 const report=previewConversion(d,'cars',{column:'value',mode:'replace',target:{type:'enum',options:'A'}});assert.equal(report.allowed,false);assert.ok(report.failed>0);
 }finally{d.close();}
});

test('conversion blocks application row-rule dependencies and fingerprints rule edits',()=>{
 const d=fixture();try{table(d,'role_conversion',[text],[{value:'true'}]);d.prepare("INSERT INTO _application_local_roles(app_id,name,label) VALUES('default','test_reader','Test reader')").run();
 const request={column:'value',mode:'replace',target:{type:'yesno'}},before=conversionFingerprint(d,'role_conversion',request);
 d.prepare("INSERT INTO _application_role_rows(app_id,role_name,table_name,operation,expression) VALUES('default','test_reader','role_conversion','read','[value] = 1')").run();
 assert.notEqual(conversionFingerprint(d,'role_conversion',request),before);assert.throws(()=>previewConversion(d,'role_conversion',request));assert.throws(()=>applyConversion(d,'role_conversion',request));
 assert.equal(d.prepare('SELECT value FROM t_role_conversion').get().value,'true');
 const copy={...request,mode:'copy',target:{name:'copied',label:'Copied',type:'yesno'}};assert.equal(previewConversion(d,'role_conversion',copy).allowed,true);
 }finally{d.close();}
});

test('conversion validates User membership using the supplied isolated database',()=>{
 const d=fixture();try{table(d,'user_conversion',[text],[{value:'999999'}]);const request={column:'value',mode:'replace',target:{type:'user'}};
 const p=previewConversion(d,'user_conversion',request);assert.equal(p.allowed,false,JSON.stringify(p));assert.ok(p.failed>0);assert.throws(()=>applyConversion(d,'user_conversion',request));assert.equal(d.prepare('SELECT value FROM t_user_conversion').get().value,'999999');
 }finally{d.close();}
});

test('Ref conversion validates the new parent child-count rule before accepting the preview',()=>{
 const d=fixture();try{table(d,'parent_old',[{name:'expected',type:'number'}],[{expected:1}]);table(d,'parent_new',[{name:'expected',type:'number'}],[{expected:2}]);table(d,'children_conversion',[{name:'parent',type:'ref',ref_table:'parent_old'}],[{parent:1}]);
 d.prepare("UPDATE _columns SET is_part_of=1,part_valid_if='COUNT([_THIS]) = [expected]' WHERE table_name='children_conversion' AND name='parent'").run();
 const request={column:'parent',mode:'replace',target:{type:'ref',ref_table:'parent_new'},ref_match:'id'},p=previewConversion(d,'children_conversion',request);assert.equal(p.allowed,false,JSON.stringify(p));assert.ok(p.issues.some(i=>i.table==='parent_new'));
 assert.equal(d.prepare("SELECT ref_table FROM _columns WHERE table_name='children_conversion' AND name='parent'").get().ref_table,'parent_old');assert.equal(d.prepare('SELECT parent FROM t_children_conversion').get().parent,1);
 }finally{d.close();}
});

test('User conversion accepts eligible users and blanks, rejects inactive or denied members, and fences stale previews',()=>{
 for(const [value,allowed] of [['1',true],['2',false],['3',false],[null,true]]){const d=fixture();try{
 d.prepare("INSERT INTO _roles(name,label,builder) VALUES('reader','Reader',0)").run();
 const insert=d.prepare('INSERT INTO _users(id,name,email,password_hash,role,active,created_at,username,nickname,department) VALUES(?,?,NULL,?,?,?,?,?,?,?)');
 insert.run(1,'Owner','synthetic','owner',1,0,'test_owner','Owner','QA');insert.run(2,'Denied','synthetic','reader',1,0,'test_denied','Denied','QA');insert.run(3,'Inactive','synthetic','reader',0,0,'test_inactive','Inactive','QA');
 d.prepare("INSERT INTO _application_members(app_id,user_id,can_use) VALUES('default',2,0)").run();table(d,'user_cases',[text],[{value}]);const request={column:'value',mode:'replace',target:{type:'user'}},p=previewConversion(d,'user_cases',request);assert.equal(p.allowed,allowed,JSON.stringify(p));
 if(allowed){const fingerprint=conversionFingerprint(d,'user_cases',request);if(value){d.prepare('UPDATE _users SET active=0 WHERE id=1').run();assert.notEqual(conversionFingerprint(d,'user_cases',request),fingerprint);assert.throws(()=>applyConversion(d,'user_cases',request,fingerprint));d.prepare('UPDATE _users SET active=1 WHERE id=1').run();}applyConversion(d,'user_cases',request,conversionFingerprint(d,'user_cases',request));assert.equal(d.prepare('SELECT value FROM t_user_cases').get().value,value===null?null:1);}else assert.throws(()=>applyConversion(d,'user_cases',request));
 }finally{d.close();}}
});

test('Ref Apply rolls back metadata, rows and inline definitions if the new parent is invalid',()=>{
 const d=fixture();try{table(d,'rollback_parent_a',[{name:'expected',type:'number'}],[{expected:1}]);table(d,'rollback_parent_b',[{name:'expected',type:'number'}],[{expected:2}]);table(d,'rollback_child',[{name:'parent',type:'ref',ref_table:'rollback_parent_a'}],[{parent:1}]);d.prepare("UPDATE _columns SET is_part_of=1,part_valid_if='COUNT([_THIS]) = [expected]' WHERE table_name='rollback_child' AND name='parent'").run();
 const request={column:'parent',mode:'replace',target:{type:'ref',ref_table:'rollback_parent_b'},ref_match:'id'},before={columns:d.prepare('SELECT * FROM _columns ORDER BY id').all(),views:d.prepare('SELECT * FROM _views ORDER BY name').all(),rows:d.prepare('SELECT * FROM t_rollback_child').all()};
 assert.throws(()=>applyConversion(d,'rollback_child',request));assert.deepEqual({columns:d.prepare('SELECT * FROM _columns ORDER BY id').all(),views:d.prepare('SELECT * FROM _views ORDER BY name').all(),rows:d.prepare('SELECT * FROM t_rollback_child').all()},before);
 d.prepare('UPDATE t_rollback_parent_b SET expected=1').run();assert.equal(previewConversion(d,'rollback_child',request).allowed,true);applyConversion(d,'rollback_child',request);assert.deepEqual(d.prepare('SELECT * FROM t_rollback_child').all(),[{id:1,parent:1}]);assert.equal(d.pragma('foreign_key_check').length,0);
 }finally{d.close();}
});

test('converting another column does not reassign or revalidate an unchanged legacy User field',()=>{
 const d=fixture();try{table(d,'legacy_user',[text,{name:'assignee',type:'user'}],[{value:'A',assignee:999999}]);const request={column:'value',mode:'replace',target:{type:'enum',options:'A'}};const p=previewConversion(d,'legacy_user',request);assert.equal(p.allowed,true,JSON.stringify(p));applyConversion(d,'legacy_user',request);assert.deepEqual(d.prepare('SELECT value,assignee FROM t_legacy_user').get(),{value:'A',assignee:999999});
 }finally{d.close();}
});
