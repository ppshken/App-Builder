const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateDisplay,changeDisplayColumn,displayColumnNames,detailItemOrder}=require('../.test-build/view-display'),{detailEmpty}=require('../.test-build/detail-field-config');
const cols=[{name:'name',label:'Name',type:'text'},{name:'note',label:'Note',type:'longtext'},{name:'amount',label:'Amount',type:'number'}];
test('detail fields validate presentation, width, labels, alignment, tri-state overrides and related restrictions',()=>{
 const d={detail_fields:{name:{presentation:'emphasis',width:'half',label:'Custom',show_label:false,align:'right',hide_empty:true},note:{presentation:'excerpt',lines:3},'related:children:parent':{width:'full'}}};assert.deepEqual(validateDisplay(d,cols),d);
 for(const field of [{presentation:'html'},{width:'third'},{align:'x'},{show_label:'yes'},{hide_empty:1},{label:'x'.repeat(101)},{lines:0},{lines:11},{lines:1.5},{unknown:true}])assert.throws(()=>validateDisplay({detail_fields:{name:field}},cols));
 assert.throws(()=>validateDisplay({detail_fields:{amount:{presentation:'excerpt'}}},cols));assert.throws(()=>validateDisplay({detail_fields:{missing:{}}},cols));assert.throws(()=>validateDisplay({detail_fields:{'related:children:parent':{presentation:'card'}}},cols));
});
test('column rename/drop migrates field options and dependencies without changing other fields or order',()=>{
 const d={detail_fields:{name:{label:'Title',presentation:'card'},note:{width:'full'},'related:children:parent':{width:'half'}},detail_order:['note','related:children:parent','name']};assert.deepEqual(displayColumnNames(d).sort(),['name','note']);
 const renamed=changeDisplayColumn(d,'name','title');assert.equal(renamed.detail_fields.title.label,'Title');assert.equal(renamed.detail_fields.name,undefined);assert.deepEqual(renamed.detail_order,['note','related:children:parent','title']);const dropped=changeDisplayColumn(d,'name');assert.equal(dropped.detail_fields.name,undefined);assert.equal(d.detail_fields.name.label,'Title');
});
test('empty rules preserve zero and false; detail ordering retains related placement and adds new columns',()=>{
 for(const v of [0,false,'0','false',['x']])assert.equal(detailEmpty(v),false);for(const v of [null,undefined,'',[]])assert.equal(detailEmpty(v),true);
 assert.deepEqual(detailItemOrder(['name','note','related:c:p','new'],['related:c:p','note','name']),['related:c:p','note','name','new']);
});
