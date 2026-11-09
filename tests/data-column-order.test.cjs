const {test}=require('node:test'),assert=require('node:assert/strict');const {dataColumnOrder}=require('../.test-build/data-column-order');
test('Data column ordering groups stored columns before computed columns without reordering within groups',()=>{
 const input=[{name:'a'},{name:'v1',is_virtual:1},{name:'b',is_virtual:false},{name:'v2',is_virtual:true}];
 const sorted=dataColumnOrder(input);assert.deepEqual(sorted.map(c=>c.name),['a','b','v1','v2']);assert.deepEqual(input.map(c=>c.name),['a','v1','b','v2']);assert.equal(sorted[2],input[1]);assert.deepEqual(dataColumnOrder([]),[]);
});
