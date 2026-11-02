const {test}=require('node:test'),assert=require('node:assert/strict');
const {detailTabGroups,validateDetailTabs}=require('../.test-build/detail-tabs.js');
const {validateDisplay,displaySettings,displayColumnNames,changeDisplayColumn}=require('../.test-build/view-display.js');
const cols=[{name:'name',label:'Name',type:'text'},{name:'status',label:'Status',type:'text'},{name:'amount',label:'Amount',type:'number'}];
const tabs=[{id:'tab_info',label:'ข้อมูลทั่วไป',fields:['name','status']},{id:'tab_result',label:'ผลตรวจ',fields:['amount']}];
test('detail tabs retain ordinary layout by default and validate optional settings',()=>{
 assert.equal(displaySettings({}).detail_tabs_enabled,false);
 assert.equal(validateDisplay({detail_tabs_enabled:true,detail_tabs:tabs,detail_tabs_style:'pills'},cols).detail_tabs.length,2);
 for(const patch of [{detail_tabs_enabled:'yes'},{detail_tabs_style:'bad'},{detail_tabs:{}}])assert.throws(()=>validateDisplay(patch,cols));
});
test('detail tabs reject duplicate ids, repeated assignments, stale columns and oversized configuration',()=>{
 for(const bad of [[...tabs,{...tabs[0]}],[tabs[0],{...tabs[1],fields:['name']}],[{...tabs[0],fields:['gone']}],[{...tabs[0],label:''}],Array.from({length:13},(_,i)=>({id:'tab_'+i,label:'Tab',fields:[]}))])assert.throws(()=>validateDetailTabs(bad,cols));
 assert.doesNotThrow(()=>validateDetailTabs([{id:'tab_related',label:'Related',fields:['related:child:parent']}],cols));
});
test('detail grouping preserves visible item order, hides empty tabs and retains unassigned fields',()=>{
 const items=['amount','name','status','related:child:parent'].map(key=>({key}));const groups=detailTabGroups(items,tabs);
 assert.deepEqual(groups.map(t=>t.id),['general','tab_info','tab_result']);
 assert.deepEqual(groups[1].items.map(i=>i.key),['name','status']);
 assert.deepEqual(detailTabGroups(items.filter(i=>i.key==='amount'),tabs).map(t=>t.id),['tab_result']);
 assert.equal(detailTabGroups(items,[])[0].items.length,4);
});
test('column rename/removal updates tab membership and dependency collection',()=>{
 const display={detail_tabs_enabled:true,detail_tabs:tabs};assert(displayColumnNames(display).includes('amount'));
 const renamed=changeDisplayColumn(display,'amount','total');assert.deepEqual(renamed.detail_tabs[1].fields,['total']);
 const removed=changeDisplayColumn(display,'amount');assert.deepEqual(removed.detail_tabs[1].fields,[]);
 assert.deepEqual(display.detail_tabs[1].fields,['amount']);
});

test('cloning an application remaps Related tab fields while preserving labels',()=>{
 const {remapApplicationConfig}=require('../.test-build/application-clone-config.js');
 const original={detail_tabs:[{id:'tab_checks',label:'related:child:parent',fields:['name','related:child:parent']}]};
 const cloned=remapApplicationConfig(original,{child:'copied_child'});
 assert.deepEqual(cloned.detail_tabs[0].fields,['name','related:copied_child:parent']);assert.equal(cloned.detail_tabs[0].label,'related:child:parent');
});
