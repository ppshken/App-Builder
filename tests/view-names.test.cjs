const {test}=require('node:test'),assert=require('node:assert/strict');const {viewNameError,runtimeViewName}=require('../.test-build/view-names.js'),{validateDisplay}=require('../.test-build/view-display.js');
test('View names are unique ignoring whitespace/case, display names are independent with legacy fallback',()=>{const saved={name:'one',label:'Orders'},all=[saved,{name:'two',label:'Customers'}];assert.match(viewNameError(' orders ',all),/มีอยู่แล้ว/);assert.match(viewNameError('CUSTOMERS',all,saved),/มีอยู่แล้ว/);assert.equal(viewNameError('Orders',all,saved),'');assert.match(viewNameError(' ',all),/กรอก/);assert.equal(viewNameError('New',all),'');const source={name:'one',label:'Orders',display:{display_name:' งานของฉัน '}};assert.equal(runtimeViewName(source).label,'งานของฉัน');assert.equal(source.label,'Orders');assert.equal(runtimeViewName({...source,display:{display_name:''}}).label,'Orders');assert.equal(runtimeViewName({...source,display:{}}).label,'Orders');assert.equal(validateDisplay({display_name:'งานของฉัน'},[]).display_name,'งานของฉัน');for(const value of [123,null,{},'x'.repeat(101)])assert.throws(()=>validateDisplay({display_name:value},[]),/Display Name/);});

test('designer separates generated references without changing runtime positions',()=>{
 const {viewCategory,VIEW_CATEGORIES}=require('../.test-build/views.js');
 for(const kind of ['detail','form']){
  assert.equal(viewCategory({kind,position:'ref',system_generated:1}),'system');
  assert.equal(viewCategory({kind,position:'ref',system_generated:0}),'ref');
  assert.equal(viewCategory({kind,position:'ref'}),'ref');
 }
 assert.equal(viewCategory({position:'primary',system_generated:1}),'primary');
 assert.equal(VIEW_CATEGORIES.find(([key])=>key==='system')[1],'System Generated');
});
