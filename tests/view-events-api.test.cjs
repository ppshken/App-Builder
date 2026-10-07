const {test}=require('node:test');const assert=require('node:assert/strict');const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(route,method='GET',body,status=200,headers={}){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('View visibility, row events, action dependencies and new icons persist and validate safely',async()=>{
 await api('/api/tables','POST',{name:'event_items',label:'เหตุการณ์',columns:[{name:'name',label:'ชื่อ',type:'text'},{name:'status',label:'สถานะ',type:'text'}]});
 await api('/api/tables','POST',{name:'event_other',label:'อื่นๆ',columns:[{name:'name',label:'ชื่อ',type:'text'}]});
 const v={name:'event_view',label:'หน้าแบบมีเงื่อนไข',table_name:'event_items',kind:'table',position:'menu',pos:90,columns:[],sort_column:'id',sort_dir:'asc',icon:'truck',show_if:'COUNT(SELECT(event_items[id], [status] = "รอ")) > 0'};
 await api('/api/views','POST',v);let runtime=await api('/api/views?runtime=1');assert.ok(runtime.hidden.includes(v.name));assert.ok(!runtime.views.some(x=>x.name===v.name));
 const row=await api('/api/data/event_items','POST',{name:'ทดสอบ',status:'รอ'});runtime=await api('/api/views?runtime=1');assert.ok(runtime.views.some(x=>x.name===v.name));
 for(const show_if of ['[status] = "รอ"','COUNT(event_items[unknown]) > 0','"hello"','IF(','COUNT(SELECT(event_items[id], [_THISROW].[status] = "รอ")) > 0',null,13])await api('/api/views','PUT',{...v,show_if},400);
 await api('/api/actions','POST',{name:'event_complete',label:'เสร็จ',table_name:'event_items',kind:'set',condition_expr:'[status] = "รอ"',values:{status:'"เสร็จ"'},confirmation:''});
 await api('/api/actions','POST',{name:'event_wrong',label:'ผิดตาราง',table_name:'event_other',kind:'delete',condition_expr:'TRUE',values:{},confirmation:''});
 for(const display of [{row_click:'other'},{row_click:'action'},{row_click:'action',row_action:'event_wrong'},{row_click:'action',row_action:'missing'}])await api('/api/views','PUT',{...v,display},400);
 await api('/api/views','PUT',{...v,display:{row_click:'action',row_action:'event_complete'}});
 const old={...v};delete old.icon;delete old.show_if;await api('/api/views','PUT',old);let saved=(await api('/api/views')).find(x=>x.name===v.name);assert.equal(saved.icon,'truck');assert.equal(saved.show_if,v.show_if);assert.equal(saved.display.row_action,'event_complete');
 await api('/api/actions?name=event_complete','DELETE',undefined,400);await api('/api/actions','PUT',{name:'event_complete',label:'เสร็จ',table_name:'event_other',kind:'delete',condition_expr:'TRUE',values:{},confirmation:''},400);
 await api('/api/tables/event_items','PATCH',{op:'drop_column',name:'status'},400);await api('/api/tables/event_items','PATCH',{op:'rename_column',name:'status',new_name:'state'});saved=(await api('/api/views')).find(x=>x.name===v.name);assert.match(saved.show_if,/\[state\]/);
 await api('/api/actions','POST',{op:'execute',name:'event_complete',id:row.id});assert.ok((await api('/api/views?runtime=1')).hidden.includes(v.name));
 await api('/api/views','PUT',{...saved,display:{row_click:'detail'},show_if:'USEREMAIL() = "a@example.com"'});assert.ok((await api('/api/views?runtime=1','GET',undefined,200,{'x-nocode-preview-email':'tester@example.com'})).views.some(x=>x.name===v.name));assert.ok((await api('/api/views?runtime=1')).views.some(x=>x.name===v.name));
 await api('/api/actions?name=event_complete','DELETE');
 await api('/api/views','DELETE',undefined,400);await api('/api/views?name=event_view','DELETE');await api('/api/tables/event_items','DELETE');await api('/api/tables/event_other','DELETE');
});
