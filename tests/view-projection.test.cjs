const {test}=require('node:test'),assert=require('node:assert/strict');const {runtimeFields,projectionColumns,parseProjection}=require('../.test-build/view-projection');
const cols=[{name:'title',type:'text',is_label:1},{name:'qty',type:'number'},{name:'extra',type:'number'},{name:'computed',type:'number',is_virtual:1,virtual_expr:'[qty]+[extra]'},{name:'broken',type:'number',is_virtual:1,virtual_expr:'1/0'},{name:'wide',type:'longtext'}];
test('View projection closes dependencies of visible values, actions and formatting without unused formulas',()=>{
 const view={kind:'table',columns:['title'],display:{summary_columns:[],image_column:'',data_styles:{title:{rules:[{condition:'[computed] > 0'}]}}}};const names=runtimeFields(cols,view,{},[{condition_expr:'[qty] > 0'}]);assert.deepEqual(names,['computed','extra','qty','title']);assert.ok(!projectionColumns(cols,['computed']).some(c=>c.name==='broken'));
 assert.equal(runtimeFields(cols,{...view,columns:[]},{},[]),undefined);assert.throws(()=>parseProjection('["bad"]',cols));assert.throws(()=>parseProjection('["title\";DROP"]',cols));
});
