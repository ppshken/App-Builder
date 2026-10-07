const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateViewCondition,viewIsVisible}=require('../.test-build/view-visibility');
const {ICON_CATALOG,EXTRA_ICONS}=require('../.test-build/icons');
const {validateDisplay,displaySettings}=require('../.test-build/view-display');
test('View Show_If has global scope, SELECT row scope, bounded syntax and a boolean result',()=>{
 const schema={orders:[{name:'status',type:'text'}]},context={tables:{orders:{columns:['id','status'],key:'id',rows:[{id:1,status:'รอ'}],labels:{}}}};
 assert.equal(validateViewCondition('COUNT(SELECT(orders[id], [status] = "รอ")) > 0',schema),'COUNT(SELECT(orders[id], [status] = "รอ")) > 0');
 assert.equal(viewIsVisible('',context),true);assert.equal(viewIsVisible('FALSE',context),false);assert.equal(viewIsVisible('COUNT(SELECT(orders[id], [status] = "รอ")) > 0',context),true);
 assert.equal(viewIsVisible('COUNT(SELECT(orders[id], [status] = "เสร็จ")) > 0',context),false);
 assert.equal(viewIsVisible('USEREMAIL() = "a@example.com"',{userEmail:'a@example.com'}),true);
 for(const source of ['[status] = "รอ"','COUNT(SELECT(orders[id], [missing] = 1)) > 0','COUNT(unknown[id]) > 0','IF(','COUNT(SELECT(orders[id], [_THISROW].[status] = "รอ")) > 0','eval("true")'])assert.throws(()=>validateViewCondition(source,schema));
 assert.throws(()=>viewIsVisible('TODAY()'));assert.throws(()=>validateViewCondition(null));assert.throws(()=>validateViewCondition('x'.repeat(10001)));
 assert.equal(displaySettings().row_click,'detail');assert.throws(()=>validateDisplay({row_click:'js'},[]));assert.throws(()=>validateDisplay({row_action:'a;DELETE'},[]));
});
test('Icon catalog preserves legacy symbols and contains over 100 unique local symbols',()=>{
 assert.ok(ICON_CATALOG.length>=100);assert.equal(new Set(ICON_CATALOG.map(i=>i.name)).size,ICON_CATALOG.length);
 for(const name of ['home','users','calendar','truck','package','chart-bar','shield'])assert.ok(ICON_CATALOG.some(i=>i.name===name));
 assert.equal(new Set(EXTRA_ICONS.map(i=>i[3])).size,EXTRA_ICONS.length);for(const i of EXTRA_ICONS)assert.match(i[3],/^[MLCQAZHVSTmlcqazhvst0-9 .,\-]+$/);
});
