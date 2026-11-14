const {test}=require('node:test'),assert=require('node:assert/strict');
const {formulaPerformance,formulaInputColumns,evaluationMetrics}=require('../.test-build/formula-performance'),{evaluateExpression}=require('../.test-build/expression'),{expressionLookup}=require('../.test-build/expression-lookup');
function data(n=180){return {columns:['id','group','amount'],key:'id',rows:Array.from({length:n},(_,i)=>({id:i+1,group:Math.floor(i/10),amount:i%3})),labels:{}};}
const nested='COUNT(SELECT(items[id], IN([id], SELECT(items[id], [group] = [_THISROW].[group]))))';
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
 const queries=[],prepare=db.prepare;db.prepare=function(sql){if(sql.includes('FROM "t_projection_items"'))queries.push(sql);return prepare.call(this,sql);};const metrics=readMetrics(),ctx=expressionContext(new Date(),'',db,metrics);assert.equal(evaluateExpression('COUNT(projection_items[id])',{},ctx),2);assert.ok(!queries[0].includes('*'));assert.ok(!queries[0].includes('body'));assert.equal(metrics.rowsLoaded,2);
 const user={id:8,name:'Reader',email:'r@example.test',role:'projection_reader'},rights={read:true,create:false,update:false,delete:false};runAuthorized(user,{owner:false,builder:false,tables:{projection_items:rights},actions:[]},()=>{queries.length=0;const scoped=readMetrics();assert.equal(evaluateExpression('COUNT(projection_items[id])',{},expressionContext(new Date(),'',db,scoped)),1);assert.ok(queries[0].includes('SELECT *'));assert.equal(scoped.rowsLoaded,1);});
 });}finally{db.close();}
});
