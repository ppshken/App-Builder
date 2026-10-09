
const assert=require('node:assert/strict');const base=process.env.NOCODE_TEST_URL;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
async function main(){
for(const [name,label] of [['rf_inspections','Inspections'],['rf_categories','Categories']])await api('/api/tables','POST',{name,label,columns:[{name:'name',label:'Name',type:'text',is_label:true}]});
for(const name of ['First','Second'])await api('/api/data/rf_inspections','POST',{name});
for(const name of ['Front','Back'])await api('/api/data/rf_categories','POST',{name});
const formula='SELECT(rf_categories[id], NOT(IN([id], SELECT(rf_photos[category], AND([inspection] = [_THISROW].[inspection], [id] <> [_THISROW].[id])))))';
await api('/api/tables','POST',{name:'rf_photos',label:'Photos',columns:[{name:'inspection',label:'Inspection',type:'ref',ref_table:'rf_inspections',required:true},{name:'category',label:'Category',type:'ref',ref_table:'rf_categories',required:true,valid_if:formula}]});
await api('/api/data/rf_photos','POST',{inspection:1,category:1});
await api('/api/data/rf_photos','POST',{inspection:1,category:1},400);
await api('/api/data/rf_photos','POST',{inspection:2,category:1});
await api('/api/data/rf_photos?id=1','PUT',{inspection:1,category:1});
await api('/api/data/rf_photos?id=2','PUT',{inspection:1,category:1},400);
await api('/api/data/rf_photos','POST',{inspection:1,category:2});
await api('/api/data/rf_photos?id=1','PUT',{inspection:1,category:2},400);
const rows=await api('/api/data/rf_photos');assert.equal(rows.length,3);assert.equal(rows.find(r=>r.id===2).inspection,2);
const data=await api('/api/expression-data?table=rf_photos&display=1');assert.ok(JSON.stringify(data).includes('rf_categories'));assert.ok(JSON.stringify(data).includes('rf_photos'));
console.log('Ref SELECT passed: duplicate rejection, separate inspections, editing own category, rejected update rollback, and runtime formula datasets.');
}main().catch(e=>{console.error(e);process.exitCode=1;});
