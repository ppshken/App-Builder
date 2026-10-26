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
