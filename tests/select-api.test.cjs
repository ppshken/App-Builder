const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('EnumList Valid_If SELECT and table[key] use full data, show labels, reject stale/forged keys and preserve dependencies',async()=>{
 const source='select_permission',owner='select_users';
 await api('/api/tables','POST',{name:source,label:'สิทธิ์',columns:[{name:'permission_key',label:'คีย์',type:'text',is_key:true},{name:'name',label:'ชื่อสิทธิ์',type:'text',is_label:true},{name:'active',label:'ใช้งาน',type:'yesno'},{name:'role',label:'บทบาท',type:'text'}]});
 for(const row of [{permission_key:'read',name:'อ่านข้อมูล',active:1,role:'staff'},{permission_key:'write',name:'แก้ไขข้อมูล',active:1,role:'admin'},{permission_key:'old',name:'ปิดใช้งาน',active:0,role:'staff'}])await api('/api/data/'+source,'POST',row);
 const formula=`SELECT(${source}[permission_key], AND([active] = TRUE, [role] = [_THISROW].[role]))`;
 await api('/api/tables','POST',{name:owner,label:'ผู้ใช้',columns:[{name:'name',label:'ชื่อ',type:'text'},{name:'role',label:'บทบาท',type:'enum',options:'staff,admin',default_expr:'"staff"'},{name:'permissions',label:'สิทธิ์',type:'enumlist',valid_if:formula,required:true},{name:'all_permissions',label:'ทั้งหมด',type:'enumlist',valid_if:`${source}[permission_key]`}]});
 const id=(await api('/api/data/'+owner,'POST',{name:'สมชาย',permissions:['read','read'],all_permissions:['read','write']})).id;
 assert.deepEqual((await api('/api/data/'+owner+'?id='+id))[0].permissions,['read']);
 for(const permissions of [['write'],['old'],['fake'],[]])await api('/api/data/'+owner,'POST',{name:'ไม่ผ่าน',permissions},400);
 await api('/api/data/'+owner+'?id='+id,'PUT',{role:'admin'},400);await api('/api/data/'+owner+'?id='+id,'PUT',{role:'admin',permissions:['write']});
 await api('/api/tables/'+owner,'PATCH',{op:'edit_column',name:'permissions',valid_if:`SELECT(${source}[permission_key], [missing] = TRUE)`},400);
 await api('/api/tables/'+owner,'PATCH',{op:'edit_column',name:'permissions',valid_if:'no_such_table[permission_key]'},400);
 await api('/api/tables/'+source,'PATCH',{op:'drop_column',name:'active'},400);await api('/api/tables/'+source,'DELETE',undefined,400);
 await api('/api/tables/'+source,'PATCH',{op:'rename_column',name:'role',new_name:'team'});
 let meta=(await api('/api/tables')).find(t=>t.name===owner);assert.equal(meta.columns.find(c=>c.name==='permissions').valid_if,formula.replace('[role] =','[team] ='));
 await api('/api/tables/'+source,'PATCH',{op:'rename_column',name:'permission_key',new_name:'permission_id'});
 meta=(await api('/api/tables')).find(t=>t.name===owner);assert.equal(meta.columns.find(c=>c.name==='all_permissions').valid_if,`${source}[permission_id]`);assert.match(meta.columns.find(c=>c.name==='permissions').valid_if,/\[permission_id\]/);
 await api('/api/data/'+owner+'?id='+id,'PUT',{name:'ชื่อใหม่'});
 const snapshot=await api('/api/expression-data?table='+owner);assert.equal(snapshot[source].key,'permission_id');assert.equal(snapshot[source].labels.write,'แก้ไขข้อมูล');
 const target=(await api('/api/data/'+source)).find(r=>r.permission_id==='write');await api('/api/data/'+source+'?id='+target.id,'PUT',{active:0});await api('/api/data/'+owner+'?id='+id,'PUT',{name:'ไม่ควรบันทึก'},400);assert.equal((await api('/api/data/'+owner+'?id='+id))[0].name,'ชื่อใหม่');
 const db=new Database(process.env.NOCODE_TEST_DB);db.pragma('foreign_keys=ON');db.transaction(()=>{const stmt=db.prepare('INSERT INTO t_select_permission(permission_id,name,active,team) VALUES(?,?,?,?)');for(let i=0;i<510;i++)stmt.run('bulk_'+i,'ชื่อสิทธิ์ '+i,1,'staff');})();db.close();
 const full=await api('/api/expression-data?table='+owner);assert.equal(full[source].rows.length,513);assert.equal(full[source].labels.bulk_509,'ชื่อสิทธิ์ 509');await api('/api/data/'+owner,'POST',{name:'ตัวเลือกท้ายตาราง',permissions:['bulk_509']});
 await api('/api/actions','POST',{name:'select_set_invalid',label:'ใส่สิทธิ์ปลอม',table_name:owner,kind:'set',condition_expr:'TRUE',confirmation:'',values:{permissions:'LIST("fake")'}});await api('/api/actions','POST',{op:'execute',name:'select_set_invalid',id},400);
});
