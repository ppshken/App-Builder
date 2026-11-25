const {test}=require('node:test'),assert=require('node:assert/strict');
const {formulaPerformance,formulaInputColumns,evaluationMetrics,readMetrics}=require('../.test-build/formula-performance'),{evaluateExpression}=require('../.test-build/expression'),{expressionLookup}=require('../.test-build/expression-lookup');
function data(n=180){return {columns:['id','group','amount'],key:'id',rows:Array.from({length:n},(_,i)=>({id:i+1,group:Math.floor(i/10),amount:i%3})),labels:{}};}
const nested='COUNT(SELECT(items[id], IN([id], SELECT(items[id], [group] = [_THISROW].[group]))))';
test('a scoped Ref virtual that reads its own whole table retains both target and aggregate columns',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context'),d=new Database(':memory:');try{initializeDatabase(d,':memory:');withDatabase(d,()=>{
 d.exec("INSERT INTO _tables(name,label) VALUES('audit_owner','Owner'),('audit_target','Target');CREATE TABLE t_audit_owner(id INTEGER PRIMARY KEY,target INTEGER);CREATE TABLE t_audit_target(id INTEGER PRIMARY KEY,amount INTEGER);INSERT INTO t_audit_owner VALUES(1,2);INSERT INTO t_audit_target VALUES(1,3),(2,7);INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('audit_target','amount','Amount','number',0,NULL),('audit_target','sum_all','Total','number',1,'SUM(audit_target[amount])')");
 const cols=[{name:'target',label:'Target',type:'ref',ref_table:'audit_target'}],source='[target].[sum_all]',snapshot=expressionContext(new Date(),'',d).snapshot([source],cols,false,{ownerTable:'audit_owner',parentIds:[1],referenceOnly:true});
 assert.ok(snapshot.audit_target.columns.includes('sum_all'));assert.equal(evaluateExpression(source,{id:1,target:2},{tables:snapshot,refTables:{target:'audit_target'}}),10);assert.equal(evaluateExpression('SUM(audit_target[amount])',{}, {tables:snapshot}),10);
 });}finally{d.close();}
});
test('server dereferences read the requested target only while explicit table formulas still read all rows',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context'),d=new Database(':memory:');try{initializeDatabase(d,':memory:');withDatabase(d,()=>{
 d.exec("INSERT INTO _tables(name,label) VALUES('ref_read_target','Target');CREATE TABLE t_ref_read_target(id INTEGER PRIMARY KEY,amount INTEGER);INSERT INTO t_ref_read_target VALUES(1,1),(2,2),(3,3),(4,4);INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('ref_read_target','amount','Amount','number',0,NULL),('ref_read_target','score','Score','number',1,'[amount]*2')");
 const metrics=readMetrics(),ctx={...expressionContext(new Date(),'',d,metrics),refTables:{target:'ref_read_target'}};
 assert.equal(evaluateExpression('[target].[score]',{target:2},ctx),4);assert.equal(metrics.rowsLoaded,1);assert.equal(metrics.rowsByTable.ref_read_target,1);
 assert.equal(evaluateExpression('[target].[score]',{target:3},ctx),6);assert.equal(evaluateExpression('SUM(ref_read_target[score])',{},ctx),20);
 const {runAuthorized}=require('../.test-build/permissions');d.exec("INSERT INTO _roles(name,label,builder) VALUES('ref_target_reader','Reader',0);INSERT INTO _role_row_rules VALUES('ref_target_reader','ref_read_target','read','[amount]>2')");runAuthorized({id:9,name:'Reader',email:'reader@example.test',role:'ref_target_reader'},{owner:false,builder:false,tables:{ref_read_target:{read:true,create:false,update:false,delete:false}},actions:[]},()=>{const restricted={...expressionContext(new Date(),'',d),refTables:{target:'ref_read_target'}};assert.throws(()=>evaluateExpression('[target].[score]',{target:2},restricted),/อ้างอิง/);assert.equal(evaluateExpression('[target].[score]',{target:3},restricted),6);});
 });}finally{d.close();}
});
test('Ref snapshots load only referenced rows, retain whole-table semantics and reject incomplete table scans',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase,readColumns}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require((process.env.NOCODE_EXPRESSION_TEST_ROOT||'../.test-build')+'/expression-context');const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec(`INSERT INTO _tables(name,label) VALUES('perf_cars','Cars'),('perf_checks','Checks');
 INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,ref_table) VALUES
 ('perf_cars','check_id','Check','ref',0,NULL,'perf_checks'),
 ('perf_checks','amount','Amount','number',0,NULL,NULL),
 ('perf_checks','score','Score','number',1,'[amount]*2',NULL);
 CREATE TABLE t_perf_cars(id INTEGER PRIMARY KEY,check_id INTEGER);CREATE TABLE t_perf_checks(id INTEGER PRIMARY KEY,amount INTEGER);
 INSERT INTO t_perf_cars VALUES(1,2),(2,4),(3,NULL);INSERT INTO t_perf_checks VALUES(1,1),(2,2),(3,3),(4,4)`);
 const owner=readColumns(db,'perf_cars'),scope={ownerTable:'perf_cars',parentIds:[1,3],referenceOnly:true},source='[check_id].[score]';
 const snapshot=expressionContext(new Date(),'',db).snapshot([source],owner,false,scope);
 assert.deepEqual(snapshot.perf_checks.rows.map(r=>r.id),[2]);assert.equal(evaluateExpression(source,{id:1,check_id:2},{tables:snapshot,refTables:{check_id:'perf_checks'}}),4);
 assert.throws(()=>evaluateExpression('SUM(perf_checks[score])',{}, {tables:snapshot}),/Ref/);
 const complete=expressionContext(new Date(),'',db).snapshot([source,'SUM(perf_checks[score])'],owner,false,scope);assert.equal(complete.perf_checks.rows.length,4);assert.equal(evaluateExpression('SUM(perf_checks[score])',{}, {tables:complete}),20);
 const next=expressionContext(new Date(),'',db).snapshot([source],owner,false,{...scope,parentIds:[2]});assert.deepEqual(next.perf_checks.rows.map(r=>r.id),[4]);
 const form=expressionContext(new Date(),'',db).snapshot([source],owner,false,{ownerTable:'perf_cars',parentIds:[1]});assert.equal(form.perf_checks.rows.length,4);assert.equal(evaluateExpression(source,{id:1,check_id:4},{tables:form,refTables:{check_id:'perf_checks'}}),8);
 const empty=expressionContext(new Date(),'',db).snapshot([source],owner,false,{...scope,parentIds:[3]});assert.equal(empty.perf_checks.rows.length,0);
 const {runAuthorized}=require('../.test-build/permissions');db.exec("INSERT INTO _roles(name,label,builder) VALUES('perf_ref_reader','Reader',0);INSERT INTO _role_row_rules VALUES('perf_ref_reader','perf_checks','read','[amount]>2')");
 const access={read:true,create:false,update:false,delete:false};runAuthorized({id:9,name:'Reader',email:'reader@example.test',role:'perf_ref_reader'},{owner:false,builder:false,tables:{perf_cars:access,perf_checks:access},actions:[]},()=>{const hidden=expressionContext(new Date(),'',db).snapshot([source],owner,false,scope);assert.equal(hidden.perf_checks.rows.length,0);});
 });}finally{db.close();}
});
test('snapshot batches sibling Ref columns so a shared virtual dependency is calculated once',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase,readColumns}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context');const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec(`INSERT INTO _tables(name,label) VALUES('perf_inspection','Inspection');
 INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES
 ('perf_inspection','amount','Amount','number',0,NULL),
 ('perf_inspection','score','Score','number',1,'[amount]*2'),
 ('perf_inspection','grade','Grade','text',1,'IF([score]>=10,"A","B")'),
 ('perf_inspection','unused','Unused','number',1,'1/0');
 CREATE TABLE t_perf_inspection(id INTEGER PRIMARY KEY,amount INTEGER);INSERT INTO t_perf_inspection VALUES(1,7),(2,3)`);
 const owner=[{name:'inspection_id',label:'Inspection',type:'ref',ref_table:'perf_inspection'}],prepare=db.prepare;let reads=0;db.prepare=function(sql){if(sql.includes('FROM "t_perf_inspection"'))reads++;return prepare.call(this,sql);};
 const snapshot=expressionContext(new Date(),'',db).snapshot(['[inspection_id].[score]','[inspection_id].[grade]'],owner);
 assert.deepEqual(snapshot.perf_inspection.rows.map(r=>[r.id,r.score,r.grade]),[[1,14,'A'],[2,6,'B']]);assert.ok(!snapshot.perf_inspection.columns.includes('unused'));
 assert.equal(reads,1,'the shared inspection score must not be recalculated by each Ref column');
 });}finally{db.close();}
});
test('related projections reuse a combined column set across more than 256 parents without mixing scopes',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context'),{readMetrics}=require('../.test-build/formula-performance');const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec("INSERT INTO _tables(name,label) VALUES('perf_parent','Parent'),('perf_child','Child');INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES('perf_child','parent_id','Parent','ref','perf_parent'),('perf_child','amount','Amount','number',NULL),('perf_child','weight','Weight','number',NULL);CREATE TABLE t_perf_parent(id INTEGER PRIMARY KEY);CREATE TABLE t_perf_child(id INTEGER PRIMARY KEY,parent_id INTEGER,amount INTEGER,weight INTEGER)");
 const insert=db.prepare('INSERT INTO t_perf_child VALUES(?,?,?,?)');for(let i=1;i<=350;i++)insert.run(i,i,i,2);
 const metrics=readMetrics(),ctx=expressionContext(new Date(),'',db,metrics);
 for(const field of ['amount','weight','amount','weight'])for(let id=1;id<=350;id++){const data=ctx.getRelatedTable('perf_child',field,{ownerTable:'perf_parent',parentIds:[id],columns:[]});assert.equal(data.rows.length,1);assert.equal(data.rows[0][field],field==='amount'?id:2);}
 assert.ok(metrics.dataLoads<=700,JSON.stringify(metrics));
 assert.throws(()=>ctx.getRelatedTable('perf_child','amount',{ownerTable:'perf_parent',parentIds:Array(501).fill(1)}),/500/);
 const blank=ctx.getRelatedTable('perf_child','amount',{ownerTable:'perf_parent',parentIds:[],includeBlank:true});assert.equal(blank.rows.length,0);
 const fresh=expressionContext(new Date(),'',db);db.prepare('UPDATE t_perf_child SET amount=999 WHERE id=1').run();assert.equal(fresh.getRelatedTable('perf_child','amount',{ownerTable:'perf_parent',parentIds:[1]}).rows[0].amount,999);
 });}finally{db.close();}
});
test('reusing an unscoped Related projection still loads the label required by a normal table read',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context');const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec("INSERT INTO _tables(name,label) VALUES('perf_label','Label');INSERT INTO _columns(table_name,name,label,type,is_label) VALUES('perf_label','title','Title','text',1),('perf_label','amount','Amount','number',0);CREATE TABLE t_perf_label(id INTEGER PRIMARY KEY,title TEXT,amount INTEGER);INSERT INTO t_perf_label VALUES(1,'Visible label',7)");const ctx=expressionContext(new Date(),'',db);ctx.getRelatedTable('perf_label','amount');const data=ctx.getTable('perf_label',['amount']);assert.equal(data.labels['1'],'Visible label');assert.equal(data.rows[0].amount,7);
 });}finally{db.close();}
});
test('formula analysis distinguishes structural cost and required virtual dependencies without evaluating values',()=>{
 assert.equal(formulaPerformance('[amount]*2').level,'light');assert.equal(formulaPerformance('COUNT([Related_items])').level,'moderate');const result=formulaPerformance(nested);assert.equal(result.nestedSelects,1);assert.equal(result.level,'review');assert.deepEqual(result.tables,['items']);
 const cols=[{name:'a',is_virtual:1,virtual_expr:'[b]*2'},{name:'b',is_virtual:1,virtual_expr:'[amount]+1'},{name:'amount',type:'number'},{name:'broken',is_virtual:1,virtual_expr:'1/0'}];assert.deepEqual(formulaInputColumns('[a]',cols).map(c=>c.name),['a','b','amount']);assert.deepEqual(formulaPerformance('[a]',cols).virtualColumns,['a','b']);assert.throws(()=>formulaPerformance('SELECT('));const defaults=[{name:'qty',type:'number',default_expr:'[rate]'},{name:'rate',is_virtual:1,virtual_expr:'1/0'}];assert.deepEqual(formulaInputColumns('[qty]',defaults,[],new Set(['qty'])).map(c=>c.name),['qty']);assert.equal(formulaInputColumns('[qty]',defaults).length,2);
});
test('nested stable SELECT reuses results only inside one evaluation and reports actual work',()=>{
 const table=data(),options={tables:{items:table},getEqualityRows:expressionLookup()};
 const base=evaluationMetrics(),optimized=evaluationMetrics();assert.equal(evaluateExpression(nested,{group:2},{...options,metrics:base}),10);assert.equal(evaluateExpression(nested,{group:2},{...options,enableSelectMemo:true,metrics:optimized}),10);assert.equal(optimized.memoHits,179);assert.ok(optimized.selectRows<base.selectRows);assert.ok(optimized.steps<base.steps);
 assert.equal(evaluateExpression(nested,{group:3},{...options,enableSelectMemo:true}),10);
 const fresh=data(15);assert.equal(evaluateExpression(nested,{group:1},{tables:{items:fresh},getEqualityRows:expressionLookup(),enableSelectMemo:true}),5);
});
test('memoization preserves error branches, variable DISTINCT and volatile UNIQUEID calls',()=>{
 const table=data(12),options={tables:{items:table},getEqualityRows:expressionLookup(),enableSelectMemo:true};
 assert.throws(()=>evaluateExpression('COUNT(SELECT(items[id], AND(1/0=1, IN([id], SELECT(items[id], TRUE)))))',{},options),/ศูนย์/);
 assert.equal(evaluateExpression('IF(FALSE, COUNT(SELECT(items[id], 1/0=1)), 7)',{},options),7);
 const volatile=evaluationMetrics();evaluateExpression('SELECT(items[id], COUNT(SELECT(items[id], UNIQUEID() <> "")) > 0)',{},{...options,metrics:volatile});assert.equal(volatile.memoHits,0);
 const distinct=evaluationMetrics();const formula='SELECT(items[id], COUNT(SELECT(items[amount], TRUE, [amount] = 1)) > 3)';assert.deepEqual(evaluateExpression(formula,{}, {...options,metrics:distinct}),evaluateExpression(formula,{}, {...options,enableSelectMemo:false}));assert.equal(distinct.memoHits,0);
});
test('memoized nested SELECT can finish large-table calculation without increasing the step budget',()=>{
 const table=data(12000),options={tables:{items:table},getEqualityRows:expressionLookup()};assert.throws(()=>evaluateExpression(nested,{group:2},options),/คำนวณมากเกินไป/);const metrics=evaluationMetrics();assert.equal(evaluateExpression(nested,{group:2},{...options,enableSelectMemo:true,metrics}),10);assert.equal(metrics.memoHits,11999);assert.equal(metrics.selectRows,12010);
});
test('formula projections avoid unused wide columns but preserve full-row permission checks and visible metrics',()=>{
 const Database=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context'),{runAuthorized}=require('../.test-build/permissions'),{readMetrics}=require('../.test-build/formula-performance');const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec("INSERT INTO _tables(name,label) VALUES('projection_items','Projection');INSERT INTO _columns(table_name,name,label,type) VALUES('projection_items','title','Title','text'),('projection_items','amount','Amount','number'),('projection_items','body','Body','longtext');CREATE TABLE t_projection_items(id INTEGER PRIMARY KEY,title TEXT,amount REAL,body TEXT);INSERT INTO t_projection_items VALUES(1,'First',1,'wide data'),(2,'Second',2,'hidden data');INSERT INTO _roles(name,label,builder) VALUES('projection_reader','Reader',0);INSERT INTO _role_row_rules VALUES('projection_reader','projection_items','read','[amount] = 1')");
 const queries=[],prepare=db.prepare;db.prepare=function(sql){if(sql.includes('FROM "t_projection_items"'))queries.push(sql);return prepare.call(this,sql);};const metrics=readMetrics(),ctx=expressionContext(new Date(),'',db,metrics);assert.equal(evaluateExpression('COUNT(projection_items[id])',{},ctx),2);assert.ok(!queries[0].includes('*'));assert.ok(!queries[0].includes('body'));assert.equal(metrics.rowsLoaded,0);
 const user={id:8,name:'Reader',email:'r@example.test',role:'projection_reader'},rights={read:true,create:false,update:false,delete:false};runAuthorized(user,{owner:false,builder:false,tables:{projection_items:rights},actions:[]},()=>{queries.length=0;const scoped=readMetrics();assert.equal(evaluateExpression('COUNT(projection_items[id])',{},expressionContext(new Date(),'',db,scoped)),1);assert.ok(queries[0].includes('SELECT *'));assert.equal(scoped.rowsLoaded,1);});
 });}finally{db.close();}
});
