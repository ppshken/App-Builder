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
