const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {evaluateExpression,parseExpression,references,tableReferences,relatedReferences,formatFormula,renameReference,remapExpressionTables}=require('../.test-build/expression');
const {calculateRow,formulaErrors}=require('../.test-build/columns');
const {initializeDatabase,readColumns}=require('../.test-build/schema');
const {withDatabase}=require('../.test-build/db');
const {expressionContext}=require('../.test-build/expression-context');
const {runAuthorized}=require('../.test-build/permissions');
const {formulaCompletions}=require('../.test-build/formula-completion');
const {externalFormulaUse}=require('../.test-build/formula-dependencies');
const now=new Date('2026-11-01T00:00:00Z'),image='/api/images/00000000-0000-4000-8000-000000000001';
const data={columns:['id','product_id','other_id','image','amount'],key:'id',labels:{},refs:{product_id:'products',other_id:'other'},rows:[
  {id:1,product_id:7,other_id:99,image,amount:3},
  {id:2,product_id:7,other_id:99,image:null,amount:4},
  {id:3,product_id:8,other_id:7,image:'other-image',amount:10},
  {id:4,product_id:null,other_id:null,image:'orphan',amount:20}
]};
const context={tableName:'products',tables:{product_image:data}};
test('Related projection follows the current parent and composes with list functions and List row identity',()=>{
 const row={id:7};
 assert.deepEqual(evaluateExpression('[Related_product_image][image]',row,context),[image]);
 assert.deepEqual(evaluateExpression('[Related_product_image]',row,context),['1','2']);
 assert.equal(evaluateExpression('COUNT([Related_product_image])',row,context),2);
 assert.equal(evaluateExpression('SUM([Related_product_image][amount])',row,context),7);
 assert.equal(evaluateExpression('INDEX([Related_product_image][image], 1)',row,context),image);
 assert.deepEqual(evaluateExpression('[Related_product_image][image]',{},context),[]);
 assert.deepEqual(evaluateExpression('[Related_product_image][image]',{id:999},context),[]);
 assert.deepEqual(evaluateExpression('[Related_product_image][image]',row,{...context,referenceListTable:'product_image'}),['1']);
 assert.throws(()=>evaluateExpression('[Related_product_image][image]',row,{...context,referenceListTable:'wrong'}),/List/);
 assert.deepEqual(evaluateExpression('ORDERBY([Related_product_image], [amount], TRUE)',row,context),['2','1']);
});
test('Related scope follows a SELECT candidate; ambiguous, mismatched and virtual-only links fail closed',()=>{
 const tables={...context.tables,products:{columns:['id'],key:'id',labels:{},rows:[{id:7},{id:8}]}};
 assert.deepEqual(evaluateExpression('SELECT(products[id], COUNT([Related_product_image]) = 2)',{}, {tables}),['7']);
 assert.throws(()=>evaluateExpression('[Related_product_image][image]',{id:7},{...context,tableName:'wrong'}),/ไม่พบ Ref/);
 const ambiguous={...context,tables:{product_image:{...data,refs:{product_id:'products',other_id:'products'}}}};
 assert.throws(()=>evaluateExpression('[Related_product_image][image]',{id:7},ambiguous),/หลายช่อง/);
 assert.deepEqual(evaluateExpression('[Related_product_image:other_id][image]',{id:7},ambiguous),['other-image']);
 assert.throws(()=>evaluateExpression('[Related_product_image][image]',{id:7},{...context,tables:{product_image:{...data,relatedRefs:{}}}}),/ไม่พบ Ref/);
 for(const source of ['[Related___proto__][image]','[Related_id][image]','[Related_product_image][__SYNC_SOURCE]','[Related_product_image:__proto__][image]'])assert.throws(()=>parseExpression(source));
});
test('Related dependencies, formatting, rename and application remapping retain identifiers and string literals',()=>{
 const source='INDEX([Related_product_image:product_id][image], 1)';
 assert.deepEqual(references(source),['id']);
 assert.deepEqual(tableReferences(source),[{table:'product_image',column:'image'},{table:'product_image',column:'product_id'}]);
 assert.deepEqual(relatedReferences(source),[{table:'product_image',column:'image',refColumn:'product_id',ownerTable:undefined}]);
 assert.equal(evaluateExpression(formatFormula(source),{id:7},context),image);
 assert.equal(renameReference(source,'image','photo','product_image'),'INDEX([Related_product_image:product_id][photo], 1)');
 assert.equal(renameReference(source,'product_id','parent_id','product_image'),'INDEX([Related_product_image:parent_id][image], 1)');
 assert.equal(remapExpressionTables(source+' & "[Related_product_image][image]"',{product_image:'copied_images'}),'INDEX([Related_copied_images:product_id][image], 1) & "[Related_product_image][image]"');
});
function fixture(work){const db=new Database(':memory:');try{initializeDatabase(db,':memory:');return withDatabase(db,()=>{
 db.exec(`INSERT INTO _tables(name,label) VALUES('products','Products'),('product_image','Images');
 INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,is_label,ref_table) VALUES
 ('products','name','Name','text',0,NULL,1,NULL),
 ('products','cover','Cover','image',1,'INDEX([Related_product_image][image], 1)',0,NULL),
 ('products','count','Count','number',1,'COUNT([Related_product_image])',0,NULL),
 ('product_image','product_id','Product','ref',0,NULL,0,'products'),
 ('product_image','image','Image','image',0,NULL,0,NULL),
 ('product_image','parent_name','Parent name','text',1,'[product_id].[name]',0,NULL);
 CREATE TABLE t_products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);
 CREATE TABLE t_product_image(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,image TEXT);
 INSERT INTO t_products VALUES(7,'First'),(8,'Second');`);
 db.prepare('INSERT INTO t_product_image VALUES(?,?,?)').run(1,7,image);
 db.prepare('INSERT INTO t_product_image VALUES(?,?,?)').run(2,8,image);
 return work(db);
});}finally{db.close();}}
test('server and browser snapshots project Related fields without recursively evaluating unrelated child formulas',()=>fixture(db=>{
 const cols=readColumns(db,'products'),ctx=expressionContext(now,'',db);
 assert.deepEqual(formulaErrors(cols,{products:cols,product_image:readColumns(db,'product_image')}),{});
 const result=calculateRow(cols,{id:7,name:'First'},false,now,false,'',ctx).row;
 assert.equal(result.cover,image);assert.equal(result.count,1);
 const snapshot=expressionContext(now,'',db).snapshot(cols.map(c=>c.virtual_expr||''),cols);
 assert.ok(!snapshot.product_image.columns.includes('parent_name'));
 assert.deepEqual(snapshot.product_image.relatedRefs,{product_id:'products'});
 assert.equal(calculateRow(cols,{id:7,name:'First'},false,now,false,'',{tables:snapshot}).row.cover,image);
 assert.equal(calculateRow(cols,{name:'New'},false,now,false,'',{tables:snapshot}).row.count,0);
 const mixed=expressionContext(now,'',db).snapshot(['[Related_product_image][image]','product_image[parent_name]'],cols);
 assert.ok(mixed.product_image.columns.includes('parent_name'));
 assert.equal(mixed.product_image.rows[0].parent_name,'First');
}));
test('Related snapshots enforce child row/table permissions and do not share snapshots between users',()=>fixture(db=>{
 db.exec(`INSERT INTO _roles(name,label,builder) VALUES('staff','Staff',0);INSERT INTO _role_row_rules VALUES('staff','product_image','read','[id] = 2');`);
 const user={id:2,name:'Staff',email:'staff@example.test',role:'staff'},rights={read:true,create:false,update:false,delete:false};
 runAuthorized(user,{owner:false,builder:false,tables:{products:rights,product_image:rights},actions:[]},()=>{
  const ctx=expressionContext(now,'',db),cols=readColumns(db,'products');
  assert.equal(calculateRow(cols,{id:7,name:'First'},false,now,false,'',ctx).row.cover,null);
  assert.equal(ctx.snapshot(['[Related_product_image][image]'],cols).product_image.rows.length,1);
 });
 runAuthorized(user,{owner:false,builder:false,tables:{products:rights},actions:[]},()=>{
  const ctx=expressionContext(now,'',db);
  assert.throws(()=>evaluateExpression('[Related_product_image][image]',{id:7},{...ctx,tableName:'products'}),e=>e.status===403);
  assert.deepEqual(Object.keys(ctx.snapshot(['[Related_product_image][image]'],readColumns(db,'products'),true)),[]);
 });
 assert.equal(calculateRow(readColumns(db,'products'),{id:7,name:'First'},false,now,false,'',expressionContext(now,'',db)).row.cover,image);
}));
test('schema checks, completion and deletion guards recognize Related relationship dependencies',()=>fixture(db=>{
 const cols=readColumns(db,'products'),children=readColumns(db,'product_image'),schema={products:cols,product_image:children};
 assert.deepEqual(formulaErrors(cols,schema),{});
 assert.match(externalFormulaUse('product_image','image'),/products/);
 assert.match(externalFormulaUse('product_image','product_id'),/products/);
 const broken={...schema,product_image:children.map(c=>c.name==='product_id'?{...c,ref_table:'wrong'}:c)};
 assert.match(formulaErrors(cols,broken)['cover.virtual_expr'],/ไม่พบ Ref/);
 const tables=[{name:'products',columns:cols},{name:'product_image',columns:children}];
 assert.ok(formulaCompletions('[Related_',9,cols,tables).items.some(c=>c.label==='Related_product_image'));
 assert.ok(formulaCompletions('[Related_product_image][im',25,cols,tables).items.some(c=>c.label==='image'));
}));
test('cloning an app remaps Related aliases to its own child table and preserves parent identity',()=>fixture(db=>{
 const {cloneApplication}=require('../.test-build/application-lifecycle');
 const copied=cloneApplication({id:1,name:'Owner',email:'owner@example.test',role:'owner'},'default','Related copy','new',true);
 const parent=copied.table_mapping.products,child=copied.table_mapping.product_image,cols=readColumns(db,parent);
 assert.equal(cols.find(c=>c.name==='cover').virtual_expr,`INDEX([Related_${child}][image], 1)`);
 assert.equal(readColumns(db,child).find(c=>c.name==='product_id').ref_table,parent);
 assert.equal(calculateRow(cols,{id:7,name:'First'},false,now,false,'',expressionContext(now,'',db)).row.cover,image);
 assert.deepEqual(db.pragma('foreign_key_check'),[]);
}));

function inspectionFixture(work){const db=new Database(':memory:');try{initializeDatabase(db,':memory:');return withDatabase(db,()=>{
 db.exec(`INSERT INTO _tables(name,label) VALUES('inspection','Inspection'),('inspection_groups','Groups'),('list_inspection','Rows');
 INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,ref_table) VALUES
 ('inspection','name','Name','text',0,NULL,NULL),
 ('inspection_groups','type_access','Types','enumlist',0,NULL,NULL),
 ('list_inspection','inspection_id','Inspection','ref',0,NULL,'inspection'),
 ('list_inspection','inspection_groups_id','Group','ref',0,NULL,'inspection_groups'),
 ('list_inspection','current_inspection_type','Type','text',0,NULL,NULL),
 ('list_inspection','current_list_inspection','Count','number',1,'COUNT(SELECT(list_inspection[id], [inspection_id] = [_THISROW].[inspection_id]))',NULL),
 ('list_inspection','unrelated_cycle','Cycle','number',1,'COUNT(SELECT(list_inspection[unrelated_cycle], TRUE))',NULL);
 UPDATE _columns SET options='bus,van' WHERE table_name='inspection_groups' AND name='type_access';
 CREATE TABLE t_inspection(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO t_inspection VALUES(7,'First'),(8,'Second');
 CREATE TABLE t_inspection_groups(id INTEGER PRIMARY KEY,type_access TEXT);INSERT INTO t_inspection_groups VALUES(10,'["bus"]'),(11,'["bus"]'),(12,'["bus"]'),(13,'["van"]');
 CREATE TABLE t_list_inspection(id INTEGER PRIMARY KEY,inspection_id INTEGER,inspection_groups_id INTEGER,current_inspection_type TEXT);
 INSERT INTO t_list_inspection VALUES(1,7,10,'bus'),(2,7,11,'bus'),(3,8,10,'bus');`);
 return work(db);
 });}finally{db.close();}}
const inspectionCount='COUNT(SELECT(list_inspection[id], [inspection_id] = [_THISROW].[inspection_id]))';
const inspectionChoices='SELECT(inspection_groups[id], AND(IN([_THISROW].[current_inspection_type], [type_access]), NOT(IN([id], SELECT(list_inspection[inspection_groups_id], [inspection_id] = [_THISROW].[inspection_id])))))';
test('SELECT self-table counts and nested Valid_if read only required fields on server and browser',()=>inspectionFixture(db=>{
 const cols=readColumns(db,'list_inspection'),row={inspection_id:7,current_inspection_type:'bus'},ctx=expressionContext(now,'',db);
 assert.equal(evaluateExpression(inspectionCount,row,ctx),2);
 assert.equal(evaluateExpression('IF(TRUE, '+inspectionCount+', COUNT(list_inspection[unrelated_cycle]))',row,ctx),2);
 assert.deepEqual(evaluateExpression(inspectionChoices,row,ctx),['12']);
 const snapshot=expressionContext(now,'',db).snapshot([inspectionCount,inspectionChoices],cols);
 assert(!snapshot.list_inspection.columns.includes('current_list_inspection'));
 assert(!snapshot.list_inspection.columns.includes('unrelated_cycle'));
 assert.equal(evaluateExpression(inspectionCount,row,{tables:snapshot}),2);
 assert.deepEqual(evaluateExpression(inspectionChoices,row,{tables:snapshot}),['12']);
 assert.equal(evaluateExpression(inspectionCount,{inspection_id:999},ctx),0);
 assert.throws(()=>evaluateExpression('list_inspection[unrelated_cycle]',row,expressionContext(now,'',db)),/วนกัน/);
}));
test('SELECT projected rows still enforce row and table permissions',()=>inspectionFixture(db=>{
 db.exec("INSERT INTO _roles(name,label,builder) VALUES('inspection_staff','Staff',0); INSERT INTO _role_row_rules VALUES('inspection_staff','list_inspection','read','[id] = 2');");
 const user={id:8,name:'Staff',email:'staff@example.test',role:'inspection_staff'},rights={read:true,create:false,update:false,delete:false};
 runAuthorized(user,{owner:false,builder:false,tables:{list_inspection:rights},actions:[]},()=>{
  assert.equal(evaluateExpression(inspectionCount,{inspection_id:7},expressionContext(now,'',db)),1);
  const snapshot=expressionContext(now,'',db).snapshot([inspectionCount],readColumns(db,'list_inspection'));
  assert.deepEqual(snapshot.list_inspection.rows.map(r=>r.id),[2]);
 });
 runAuthorized(user,{owner:false,builder:false,tables:{},actions:[]},()=>assert.throws(()=>evaluateExpression(inspectionCount,{inspection_id:7},expressionContext(now,'',db)),/สิทธิ์/));
}));

test('Related reads only current-parent children in large tables while retaining per-parent and unscoped limits',()=>fixture(db=>{
 db.exec("CREATE INDEX _ref_product_image_product_id ON t_product_image(product_id);WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");
 const ctx=expressionContext(now,'',db),opts={...ctx,tableName:'products'};
 assert.equal(evaluateExpression('COUNT([Related_product_image])',{id:7},opts),1);
 assert.equal(evaluateExpression('COUNT([Related_product_image])',{id:999},opts),0);
 assert.equal(evaluateExpression('COUNT([Related_product_image])',{},opts),0);
 assert.throws(()=>evaluateExpression('COUNT([Related_product_image])',{id:8},opts),/10,000/);
 assert.throws(()=>ctx.getTable('product_image'),/10,000/);
 const plan=db.prepare('EXPLAIN QUERY PLAN SELECT * FROM t_product_image WHERE product_id=? ORDER BY id LIMIT 10001').all(7);assert.ok(plan.some(x=>x.detail.includes('_ref_product_image_product_id')));
}));

test('Scoped Related snapshots preserve permission filtering, empty parents and reject use outside their coverage',()=>fixture(db=>{
 db.exec("WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");
 const cols=readColumns(db,'products'),snapshot=expressionContext(now,'',db).snapshot(['COUNT([Related_product_image])'],cols,false,{ownerTable:'products',parentIds:[7]});
 assert.equal(snapshot.product_image.rows.length,1);assert.deepEqual(snapshot.product_image.related_scope,{ownerTable:'products',parentIds:[7],refColumns:['product_id']});
 assert.equal(evaluateExpression('COUNT([Related_product_image])',{id:7},{tableName:'products',tables:snapshot}),1);
 assert.throws(()=>evaluateExpression('COUNT([Related_product_image])',{id:8},{tableName:'products',tables:snapshot}),/ครอบคลุม/);
 const empty=expressionContext(now,'',db).snapshot(['COUNT([Related_product_image])'],cols,false,{ownerTable:'products',parentIds:[]});assert.equal(empty.product_image.rows.length,0);assert.equal(evaluateExpression('COUNT([Related_product_image])',{}, {tableName:'products',tables:empty}),0);
 db.exec("INSERT INTO _roles(name,label,builder) VALUES('scoped_staff','Staff',0);INSERT INTO _role_row_rules VALUES('scoped_staff','product_image','read','[id] = 2')");
 const rights={read:true,create:false,update:false,delete:false},user={id:2,name:'Staff',email:'staff@example.test',role:'scoped_staff'};
 runAuthorized(user,{owner:false,builder:false,tables:{products:rights,product_image:rights},actions:[]},()=>{const snap=expressionContext(now,'',db).snapshot(['COUNT([Related_product_image])'],cols,false,{ownerTable:'products',parentIds:[7]});assert.equal(snap.product_image.rows.length,0);});
}));

test('Related ORDERBY loads scoped sort fields and mixed whole-table snapshots never silently truncate',()=>fixture(db=>{
 const cols=readColumns(db,'products'),scope={ownerTable:'products',parentIds:[7]},formula='ORDERBY([Related_product_image], [image], TRUE)';
 const snap=expressionContext(now,'',db).snapshot([formula],cols,false,scope);
 assert.ok(snap.product_image.columns.includes('image'));assert.equal(snap.product_image.rows.length,1);assert.deepEqual(evaluateExpression(formula,{id:7},{tableName:'products',tables:snap}),['1']);
 assert.throws(()=>evaluateExpression('COUNT(SELECT(product_image[id], TRUE))',{id:7},{tableName:'products',tables:snap}),/เฉพาะ Related/);
 const mixed=expressionContext(now,'',db).snapshot(['[Related_product_image][image]','product_image[parent_name]'],cols,false,scope);assert.equal(mixed.product_image.rows.length,2);assert.equal(mixed.product_image.related_scope,undefined);assert.ok(mixed.product_image.columns.includes('image'));assert.ok(mixed.product_image.columns.includes('parent_name'));
 db.exec("WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");assert.deepEqual(evaluateExpression(formula,{id:7},{...expressionContext(now,'',db),tableName:'products'}),['1']);
}));

test('Scoped Related cache is request-local and bounded across many parent rows',()=>fixture(db=>{
 const original=db.prepare;let reads=0;db.prepare=function(sql){if(sql.includes('json_each(?)'))reads++;return original.call(this,sql);};
 try{const ctx={...expressionContext(now,'',db),tableName:'products'},formula='COUNT([Related_product_image])';assert.equal(evaluateExpression(formula,{id:7},ctx),1);const first=reads;assert.equal(evaluateExpression(formula,{id:7},ctx),1);assert.equal(reads,first);for(let id=100;id<400;id++)assert.equal(evaluateExpression(formula,{id},ctx),0);const before=reads;assert.equal(evaluateExpression(formula,{id:7},ctx),1);assert.equal(reads,before+1);}finally{db.prepare=original;}
}));

test('SQL-scoped Related retains explicit Ref disambiguation and separates caches for each link',()=>fixture(db=>{
 db.exec("ALTER TABLE t_product_image ADD COLUMN other_id INTEGER;INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES('product_image','other_id','Other','ref','products');UPDATE t_product_image SET other_id=CASE id WHEN 1 THEN 8 ELSE 7 END");
 const ctx={...expressionContext(now,'',db),tableName:'products'};assert.throws(()=>evaluateExpression('[Related_product_image]',{id:7},ctx),/หลายช่อง/);assert.deepEqual(evaluateExpression('[Related_product_image:product_id]',{id:7},ctx),['1']);assert.deepEqual(evaluateExpression('[Related_product_image:other_id]',{id:7},ctx),['2']);
 const snap=expressionContext(now,'',db).snapshot(['[Related_product_image:product_id]','[Related_product_image:other_id]'],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[7]});assert.equal(snap.product_image.rows.length,2);assert.deepEqual(evaluateExpression('[Related_product_image:other_id]',{id:7},{tables:snap,tableName:'products'}),['2']);
}));

test('SELECT accepts Related projections, scopes child conditions, outer row, distinct and nested owners',()=>{
 const opts={...context,tables:{...context.tables,products:{columns:['id'],key:'id',labels:{},rows:[{id:7},{id:8}]}}};
 assert.equal(evaluateExpression('SUM(SELECT([Related_product_image][amount], [amount] > 3))',{id:7},opts),4);
 assert.deepEqual(evaluateExpression('SELECT([Related_product_image], [amount] >= 4)',{id:7},opts),['2']);
 assert.deepEqual(evaluateExpression('SELECT([Related_product_image][amount], [product_id] = [_THISROW].[id])',{id:7},opts),['3','4']);
 assert.deepEqual(evaluateExpression('SELECT([Related_product_image][amount], TRUE)',{},opts),[]);
 assert.deepEqual(evaluateExpression('SELECT(products[id], COUNT(SELECT([Related_product_image][amount], [amount] > 3)) > 0)',{},opts),['7','8']);
 const source='SELECT([Related_product_image][amount], [amount] > [_THISROW].[minimum])';assert.deepEqual(new Set(references(source)),new Set(['id','minimum']));assert.ok(tableReferences(source).some(r=>r.table==='product_image'&&r.column==='amount'));assert.equal(renameReference(source,'amount','score','product_image'),'SELECT([Related_product_image][score], [score] > [_THISROW].[minimum])');
 assert.deepEqual(evaluateExpression('SELECT([Related_product_image][amount], TRUE, TRUE)',{id:7},opts),['3','4']);assert.deepEqual(evaluateExpression('SELECT([Related_product_image][amount], TRUE)',{id:7},{...opts,referenceListTable:'product_image'}),['1','2']);
});

test('Related SELECT and parent-bound table SELECT read only current children in large tables',()=>fixture(db=>{
 db.exec("CREATE INDEX _ref_product_image_product_id ON t_product_image(product_id);WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");
 const opts={...expressionContext(now,'',db),tableName:'products'},formula='COUNT(SELECT(product_image[id], AND([product_id] = [_THISROW].[id], [id] = 1)))';
 assert.equal(evaluateExpression('COUNT(SELECT([Related_product_image], [id] = 1))',{id:7},opts),1);
 assert.equal(evaluateExpression(formula,{id:7},opts),1);
 const snap=expressionContext(now,'',db).snapshot([formula],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[7]});assert.equal(snap.product_image.rows.length,1);assert.equal(evaluateExpression(formula,{id:7},{tableName:'products',tables:snap}),1);
 assert.throws(()=>evaluateExpression('COUNT(SELECT(product_image[id], OR([product_id] = [_THISROW].[id], TRUE)))',{id:7},opts),/10,000/);
}));

test('SELECT Related condition completions, schema validation and saved formula dependencies use child columns',()=>fixture(db=>{
 const source='SELECT([Related_product_image][image], [product_id] = [_THISROW].[id])',cols=readColumns(db,'products'),schema={products:cols,product_image:readColumns(db,'product_image')};
 assert.deepEqual(formulaErrors([...cols,{name:'filtered',label:'Filtered',type:'list',is_virtual:1,virtual_expr:source}],schema,'products'),{});
 const prefix='SELECT([Related_product_image][image], [prod',items=formulaCompletions(prefix,prefix.length,cols,[{name:'product_image',columns:schema.product_image}]).items;assert.ok(items.some(i=>i.label==='product_id'));assert.ok(!items.some(i=>i.label==='cover'));
 assert.equal(evaluateExpression('COUNT(SELECT([Related_product_image], FALSE))',{id:7},{...expressionContext(now,'',db),tableName:'products'}),0);
}));

test('Parent SELECT keeps blank/orphan semantics and snapshot completeness separate from Related',()=>fixture(db=>{
 db.exec("INSERT INTO t_product_image(id,product_id,image) VALUES(3,NULL,'orphan');WITH RECURSIVE n(x) AS (SELECT 4 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");
 const formula='SELECT(product_image[id], [product_id] = [_THISROW].[id])',opts={...expressionContext(now,'',db),tableName:'products'};assert.deepEqual(evaluateExpression(formula,{id:null},opts),['3']);assert.deepEqual(evaluateExpression('SELECT([Related_product_image], TRUE)',{},opts),[]);
 const snap=expressionContext(now,'',db).snapshot([formula],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[]});assert.equal(snap.product_image.rows.length,1);assert.deepEqual(evaluateExpression(formula,{id:null}, {tables:snap,tableName:'products'}),['3']);assert.deepEqual(snap.product_image.related_scope.blankRefColumns,['product_id']);
 const deferred=expressionContext(now,'',db).snapshot([formula],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[],deferBlank:true});assert.equal(deferred.product_image.rows.length,0);assert.throws(()=>evaluateExpression(formula,{id:null}, {tables:deferred,tableName:'products'}),/เฉพาะ Related/);
}));

test('Parent SELECT does not push OR/NOT predicates, non-Ref fields or nested outer scopes and preserves residual filters',()=>fixture(db=>{
 const opts={...expressionContext(now,'',db),tableName:'products'};
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], AND([product_id] = [_THISROW].[id], OR([id] = 1, [id] = 2)))',{id:7},opts),['1']);
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], [product_id] = [_THISROW].[id])',{id:'7'},opts),[]);
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], OR([product_id] = [_THISROW].[id], [id] = 2))',{id:7},opts),['1','2']);
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], [id] = [_THISROW].[id])',{id:1},opts),['1']);
}));

test('Scoped cache also bounds retained row count for dense parents',()=>fixture(db=>{
 db.exec("WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<=21002) INSERT INTO t_product_image(id,product_id,image) SELECT x,10+CAST((x-3)/7000 AS INTEGER),NULL FROM n");
 const original=db.prepare;let reads=0;db.prepare=function(sql){if(sql.includes('json_each(?)'))reads++;return original.call(this,sql);};try{const opts={...expressionContext(now,'',db),tableName:'products'};for(const id of [10,11,12])assert.equal(evaluateExpression('COUNT([Related_product_image])',{id},opts),7000);const before=reads;assert.equal(evaluateExpression('COUNT([Related_product_image])',{id:10},opts),7000);assert.equal(reads,before+1);}finally{db.prepare=original;}
}));

test('SELECT optimization preserves short-circuit errors and refuses partial snapshots for another Ref',()=>fixture(db=>{
 const opts={...expressionContext(now,'',db),tableName:'products'};
 assert.throws(()=>evaluateExpression('SELECT(product_image[id], AND(1 / 0 = 1, [product_id] = [_THISROW].[id]))',{id:999},opts),/ศูนย์/);
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], AND([product_id] = [_THISROW].[id], 1 / 0 = 1))',{id:999},opts),[]);
 db.exec("ALTER TABLE t_product_image ADD COLUMN other_id INTEGER;INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES('product_image','other_id','Other','ref','products');UPDATE t_product_image SET other_id=7");
 const snap=expressionContext(now,'',db).snapshot(['[Related_product_image:product_id]'],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[7]});
 assert.throws(()=>evaluateExpression('SELECT([Related_product_image:other_id], TRUE)',{id:7},{tables:snap,tableName:'products'}),/คอลัมน์ Ref/);
 assert.throws(()=>evaluateExpression('SELECT(product_image[id], [other_id] = [_THISROW].[id])',{id:7},{tables:snap,tableName:'products'}),/เฉพาะ Related/);
 assert.deepEqual(evaluateExpression('SELECT(product_image[id], [product_id] = [_THISROW].[id])',{id:'7) OR 1=1 --'},opts),[]);
}));

test('Related SELECT keeps duplicate values unless distinct is requested and composes with parent SELECT ORDERBY',()=>fixture(db=>{
 const opts={...context,tables:{product_image:{...data,rows:data.rows.map(r=>r.product_id===7?{...r,amount:4}:r)}}};assert.equal(evaluateExpression('SUM(SELECT([Related_product_image][amount], TRUE))',{id:7},opts),8);assert.equal(evaluateExpression('SUM(SELECT([Related_product_image][amount], TRUE, TRUE))',{id:7},opts),4);
 db.exec("WITH RECURSIVE n(x) AS (SELECT 3 UNION ALL SELECT x+1 FROM n WHERE x<10005) INSERT INTO t_product_image(id,product_id,image) SELECT x,8,NULL FROM n");
 const source='ORDERBY(SELECT(product_image[id], [product_id] = [_THISROW].[id]), [image], TRUE)',ctx={...expressionContext(now,'',db),tableName:'products'};assert.deepEqual(evaluateExpression(source,{id:7},ctx),['1']);
 const snap=expressionContext(now,'',db).snapshot([source],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[7]});assert.deepEqual(evaluateExpression(source,{id:7},{tables:snap,tableName:'products'}),['1']);
}));

test('SELECT Related respects pending child edits, additions, deletions and cancellation',()=>fixture(db=>{
 const {withDraftExpressionRows}=require('../.test-build/draft-expression');db.exec("ALTER TABLE t_product_image ADD COLUMN amount REAL;INSERT INTO _columns(table_name,name,label,type) VALUES('product_image','amount','Amount','number');UPDATE t_product_image SET amount=3");
 const formula='SUM(SELECT([Related_product_image][amount], [amount] >= 4))',snap=expressionContext(now,'',db).snapshot([formula],readColumns(db,'products'),false,{ownerTable:'products',parentIds:[7]});
 const scope={table:'product_image',column:'product_id',parentId:7,editingKey:'',records:[{key:'edit',id:1,values:{amount:4}},{key:'new',values:{amount:5}}]};
 assert.equal(evaluateExpression(formula,{id:7},{tables:withDraftExpressionRows(snap,scope),tableName:'products'}),9);
 scope.records[0].deleted=true;assert.equal(evaluateExpression(formula,{id:7},{tables:withDraftExpressionRows(snap,scope),tableName:'products'}),5);assert.equal(evaluateExpression(formula,{id:7},{tables:snap,tableName:'products'}),0);
}));
