const {test}=require('node:test');
const assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(route,method='GET',body,status=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('View icon and group options validate, persist, survive older writes and follow column changes safely',async()=>{
 await api('/api/tables','POST',{name:'group_items',label:'จัดกลุ่ม',columns:[{name:'name',label:'ชื่อ',type:'text',is_label:true},{name:'category',label:'หมวดหมู่',type:'text'},{name:'spare',label:'อื่นๆ',type:'text'}]});
 const original={name:'group_view',label:'แยกหมวดหมู่',table_name:'group_items',kind:'list',position:'primary',pos:0,columns:['name'],sort_column:'id',sort_dir:'asc'};
 await api('/api/views','POST',{...original,icon:'folder',group_column:'category',group_dir:'desc'});
 await api('/api/views','PUT',{...original,label:'เปลี่ยนชื่อ'});
 let saved=(await api('/api/views')).find(v=>v.name===original.name);assert.equal(saved.icon,'folder');assert.equal(saved.group_column,'category');assert.equal(saved.group_dir,'desc');
 for(const bad of [{icon:'<script>'},{group_column:'name;DROP TABLE _tables'},{group_column:'unknown'},{group_dir:'sideways'}])await api('/api/views','PUT',{...saved,...bad},400);
 await api('/api/slices','POST',{name:'group_slice',label:'เฉพาะหมวดหมู่',table_name:'group_items',filter_expr:'TRUE',columns:['name','category']});
 await api('/api/views','PUT',{...saved,slice_name:'group_slice'});
 await api('/api/slices','PUT',{op:'save',name:'group_slice',label:'เฉพาะหมวดหมู่',table_name:'group_items',filter_expr:'TRUE',columns:['name']},400);
 await api('/api/tables/group_items','PATCH',{op:'rename_column',name:'category',new_name:'category_new'});
 saved=(await api('/api/views')).find(v=>v.name===original.name);assert.equal(saved.group_column,'category_new');
 await api('/api/tables/group_items','PATCH',{op:'drop_column',name:'category_new'});
 saved=(await api('/api/views')).find(v=>v.name===original.name);assert.equal(saved.group_column,'');assert.equal(saved.icon,'folder');
 await api('/api/tables/group_items','DELETE');
});
