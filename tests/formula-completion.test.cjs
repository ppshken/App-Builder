const {test}=require('node:test'),assert=require('node:assert/strict');
const {formulaCompletions}=require('../.test-build/formula-completion');
const {relatedFormulaSources}=require('../.test-build/formula-related');
const cols=[{name:'status',type:'enum'},{name:'qty',type:'number'}];
const tables=[{name:'inspection_groups',columns:[{name:'inspection_categories_id',type:'ref'},{name:'inspection_groups',type:'text'}]}];
const suggest=s=>formulaCompletions(s,s.length,cols,tables);
test('partial function and table names match the screenshot workflow',()=>{
 assert.ok(suggest('SE').items.some(i=>i.label==='SELECT()'));
 assert.ok(suggest('SELECT(\n  inspe').items.some(i=>i.label==='inspection_groups'));
 assert.deepEqual(suggest('inspection_groups[').items.map(i=>i.label),['id','inspection_categories_id','inspection_groups']);
 assert.equal(suggest('inspection_groups[inspection_c').items[0].insert,'inspection_categories_id]');
});
test('completion respects local columns, SELECT row scope, quoted text, and an existing closing bracket',()=>{
 assert.ok(suggest('[st').items.some(i=>i.label==='status'));
 assert.ok(suggest('SELECT(inspection_groups[id], [inspection_c').items.some(i=>i.label==='inspection_categories_id'));
 assert.equal(suggest('"SE').items.length,0);
 assert.equal(suggest('"done" + SE').items[0].label,'SELECT()');
 assert.equal(formulaCompletions('[st]',3,cols,tables).items[0].insert,'status');
 assert.equal(suggest('SE').start,0);
});
test('Related choices show only physical relationships to the current parent and scalar projections',()=>{
 const parent=[{name:'name',label:'Name',type:'text',table_name:'products'}],tables=[
  {name:'product_image',label:'Images',columns:[{name:'product_id',label:'Product',type:'ref',ref_table:'products'},{name:'image',label:'Photo',type:'image'},{name:'tags',label:'Tags',type:'enumlist'},{name:'items',label:'Items',type:'list'}]},
  {name:'unrelated',columns:[{name:'other',type:'ref',ref_table:'other'}]},
  {name:'virtual_link',columns:[{name:'product',type:'ref',ref_table:'products',is_virtual:true}]}
 ];
 const sources=relatedFormulaSources(parent,tables);
 assert.equal(sources.length,1);assert.equal(sources[0].expression,'[Related_product_image]');
 assert.deepEqual(sources[0].columns.map(c=>c.name),['id','product_id','image']);
 assert.ok(formulaCompletions('[Related_',9,parent,tables).items.some(i=>i.label==='Related_product_image'));
 const projection='[Related_product_image][';
 assert.deepEqual(formulaCompletions(projection,projection.length,parent,tables).items.map(i=>i.label),['id','product_id','image']);
});
test('Related choices qualify every link when two Ref columns point at the same parent',()=>{
 const tables=[{name:'images',columns:[{name:'owner',type:'ref',ref_table:'products'},{name:'backup',type:'ref',ref_table:'products'}]}];
 const sources=relatedFormulaSources([],tables,'products');
 assert.deepEqual(sources.map(s=>s.expression),['[Related_images:owner]','[Related_images:backup]']);
 assert.deepEqual(sources.map(s=>s.refColumn),['owner','backup']);
 assert.deepEqual(relatedFormulaSources([],tables),[]);
});
