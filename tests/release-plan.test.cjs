const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyzeReleasePlan}=require('../.test-build/release-plan');
const options={appId:'default',workspaceId:'draft-test'};
const fixture=()=>({_tables:[{name:'orders',label:'Orders',owner_app_id:'default'}],_columns:[{id:1,table_name:'orders',name:'name',label:'Name',type:'text',is_virtual:0,is_key:0,is_unique:0,ref_table:null}],_views:[{name:'orders_view',label:'Orders view',table_name:'orders',display_json:'{"a":1,"b":2}'}],_automations:[{name:'worker',table_name:'orders',label:'Worker',next_run_at:100,config_json:'{"steps":[],"enabled":false}'}]});
const copy=v=>structuredClone(v);
const analyze=(base,live=base,draft=base,opts=options)=>analyzeReleasePlan(base,live,draft,opts);

test('release plan is deterministic, read-only and ignores scheduler timestamps and JSON object key order',()=>{
 const base=fixture(),live=copy(base),draft=copy(base);live._automations[0].next_run_at=999;draft._views[0].display_json='{"b":2,"a":1}';
 const inputs=JSON.stringify([base,live,draft]),plan=analyze(base,live,draft);
 assert.equal(plan.mode,'read-only');assert.equal(plan.operations.length,0);assert.equal(plan.publishBlocked,false);assert.equal(plan.fingerprints.baseline,plan.fingerprints.live);assert.equal(plan.fingerprints.live,plan.fingerprints.draft);assert.equal(JSON.stringify([base,live,draft]),inputs);
 base._columns.push({...base._columns[0],id:2,name:'amount'});const reversed=copy(base);reversed._columns.reverse();assert.deepEqual(analyze(base),analyze(reversed));
});
test('configuration changes preserve existing publish eligibility and return field names, never values',()=>{
 const base=fixture(),draft=copy(base);draft._views[0].label='Updated view';draft._views[0].display_json='{"token":"synthetic-private-value"}';const plan=analyze(base,base,draft);
 assert.equal(plan.summary.configuration,1);assert.equal(plan.summary.schema,0);assert.equal(plan.operations[0].supported,true);assert.equal(plan.publishBlocked,false);assert.deepEqual(plan.operations[0].fields,['display_json','label']);assert.ok(!JSON.stringify(plan).includes('synthetic-private-value'));
});
test('same field changes conflict; disjoint live changes are still blocked without silently merging',()=>{
 const base=fixture(),live=copy(base),draft=copy(base);live._views[0].label='Live';draft._views[0].label='Draft';let p=analyze(base,live,draft);assert.equal(p.conflicts.length,1);assert.deepEqual(p.conflicts[0].fields,['label']);assert.equal(p.publishBlocked,true);
 draft._views[0].label=base._views[0].label;draft._views[0].pos=4;p=analyze(base,live,draft);assert.equal(p.conflicts.length,0);assert.equal(p.summary.liveChanged,true);assert.ok(p.blockers.some(b=>b.code==='LIVE_CHANGED'));
 p=analyze(base,live,live);assert.equal(p.operations.length,0);assert.equal(p.conflicts.length,0);assert.equal(p.publishBlocked,true,'legacy live drift stays blocked even if both values match');
});
test('delete versus edit and simultaneous incompatible creates are conflicts',()=>{
 const base=fixture(),live=copy(base),draft=copy(base);draft._views=[];live._views[0].label='Changed';assert.equal(analyze(base,live,draft).conflicts.length,1);
 base._views=[];live._views=[{name:'new_view',label:'Live'}];draft._views=[{name:'new_view',label:'Draft'}];assert.equal(analyze(base,live,draft).conflicts.length,1);
});
test('new physical/virtual columns and table deletions are explicitly unsupported',()=>{
 const base=fixture(),draft=copy(base);draft._columns.push({...base._columns[0],id:2,name:'amount',type:'number'},{...base._columns[0],id:3,name:'total',is_virtual:1,virtual_expr:'1'});let p=analyze(base,base,draft);assert.equal(p.summary.schema,2);assert.equal(p.summary.unsupported,2);assert.ok(p.operations.every(o=>!o.supported&&o.requiresDataValidation));
 draft._tables=[];draft._columns=[];p=analyze(base,base,draft);assert.ok(p.operations.some(o=>o.kind==='delete_table'));assert.ok(p.operations.some(o=>o.kind==='delete_column'));assert.equal(p.publishBlocked,true);
});
test('type/key/ref/unique/name/identity changes are structural, never inferred from a display label',()=>{
 const base=fixture();for(const [field,value]of [['type','decimal'],['is_key',1],['is_unique',1],['ref_table','other'],['is_virtual',1],['name','renamed']]){const draft=copy(base);draft._columns[0][field]=value;const p=analyze(base,base,draft);assert.equal(p.operations[0].kind,'alter_column',field);assert.equal(p.operations[0].supported,false);}
 const draft=copy(base);draft._columns[0].id=2;const p=analyze(base,base,draft);assert.deepEqual(new Set(p.operations.map(o=>o.kind)),new Set(['create_column','delete_column']));
 draft._columns[0].id=1;draft._columns[0].label='Another label';assert.equal(analyze(base,base,draft).summary.schema,0);
});
test('table owner and source changes require a structural plan',()=>{
 const base=fixture();for(const [field,value]of [['owner_app_id','other'],['source_kind','LIVE_API'],['source_id','connection']]){const draft=copy(base);draft._tables[0][field]=value;const p=analyze(base,base,draft);assert.equal(p.operations[0].kind,'alter_table');assert.equal(p.publishBlocked,true);}
});
test('new table and Ref dependencies precede column and configuration changes',()=>{
 const base=fixture(),draft=copy(base);draft._tables.push({name:'customers',owner_app_id:'default'});draft._columns.push({id:2,table_name:'orders',name:'customer',type:'ref',ref_table:'customers'});draft._views[0].label='Show customer';const p=analyze(base,base,draft),table=p.operations.find(o=>o.kind==='create_table'),column=p.operations.find(o=>o.kind==='create_column'),view=p.operations.find(o=>o.category==='configuration');assert.ok(column.dependencies.includes(table.id));assert.ok(view.dependencies.includes(table.id));assert.ok(view.dependencies.includes(column.id));assert.ok(p.operations.indexOf(table)<p.operations.indexOf(column));assert.ok(p.operations.indexOf(column)<p.operations.indexOf(view));
});
test('shared table schema is high risk, while app-local overlays are identified separately',()=>{
 const base=fixture(),draft=copy(base);draft._columns[0].type='number';let p=analyze(base,base,draft,{...options,sharedTables:['orders']});assert.equal(p.operations[0].risk,'high');assert.ok(p.operations[0].impacts.some(s=>s.includes('แอปอื่น')));
 draft._columns=copy(base._columns);draft._table_overlays=[{table_name:'orders',config_json:'{"label":"Local"}'}];p=analyze(base,base,draft);assert.equal(p.summary.shared,1);assert.equal(p.summary.schema,0);
});
test('unrelated app metadata cannot leak into the scoped plan; explicitly granted shared tables can',()=>{
 const base=fixture();base._tables.push({name:'private_other',owner_app_id:'other'});base._columns.push({id:2,table_name:'private_other',name:'private_field',type:'text'});const draft=copy(base);draft._columns[1].type='number';let p=analyze(base,base,draft);assert.equal(p.operations.length,0);assert.ok(!JSON.stringify(p).includes('private_other'));
 p=analyze(base,base,draft,{...options,tableNames:['private_other']});assert.equal(p.summary.schema,1);assert.ok(p.operations[0].impacts.some(s=>s.includes('แอปอื่น')));
});
test('business rows and unknown catalogs are excluded, array order remains meaningful',()=>{
 const base=fixture(),draft=copy(base);draft.business_rows=[{id:42,name:'PRIVATE ROW'}];draft._users=[{password_hash:'PRIVATE HASH'}];assert.deepEqual(analyze(base,base,draft),analyze(base));assert.ok(!JSON.stringify(analyze(base,base,draft)).includes('PRIVATE'));
 draft._views[0].display_json='{"columns":["b","a"]}';assert.equal(analyze(base,base,draft).summary.configuration,1);
});
test('duplicate identities, missing column identities and missing context fail closed',()=>{
 const base=fixture(),draft=copy(base);draft._columns.push({...draft._columns[0]});assert.throws(()=>analyze(base,base,draft),/รหัสซ้ำ/);draft._columns=[{table_name:'orders',name:'unknown'}];assert.throws(()=>analyze(base,base,draft),/ไม่มีรหัส/);assert.throws(()=>analyze(base,base,base,{appId:'',workspaceId:''}),/ระบุแอป/);
 assert.equal(analyze(base,base,base,{...options,legacyConflict:true}).publishBlocked,true);
});
