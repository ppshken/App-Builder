const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('Related and List page in SQLite, use SELECT keys and labels, validate references and preserve metadata',async()=>{
 await api('/api/tables','POST',{name:'list_products',label:'สินค้า',columns:[{name:'code',label:'รหัสสินค้า',type:'text',is_key:true},{name:'name',label:'ชื่อสินค้า',type:'text',is_label:true},{name:'active',label:'ใช้งาน',type:'yesno'}]});
 const sql=new Database(process.env.NOCODE_TEST_DB);
 try{sql.transaction(()=>{const insert=sql.prepare('INSERT INTO t_list_products(code,name,active) VALUES(?,?,?)');for(let i=1;i<=601;i++)insert.run('p'+i,'สินค้าชิ้นที่ '+i,i<=23?1:0);})();}finally{sql.close();}
 await api('/api/tables','POST',{name:'list_customers',label:'ลูกค้า',columns:[{name:'name',label:'ชื่อลูกค้า',type:'text',is_label:true},{name:'picked',label:'สินค้าที่เลือก',type:'list',ref_table:'list_products',required:true,valid_if:'SELECT(list_products[code], [active]=TRUE)',default_expr:'LIST("1")'},{name:'all_products',label:'สินค้าทั้งหมด',type:'list',ref_table:'list_products',is_virtual:true,virtual_expr:'SELECT(list_products[code], TRUE)'},{name:'notes',label:'รายการข้อความ',type:'list'}]});
 const customer=(await api('/api/data/list_customers','POST',{name:'สมชาย',picked:['1','2','2'],notes:['ไทย',2]})).id;
 assert.deepEqual((await api('/api/data/list_customers?id='+customer))[0].picked,['1','2']);
 let data=(await api('/api/data/list_customers?id='+customer))[0];assert.deepEqual(data.notes,['ไทย','2']);assert.equal(data.all_products.length,601);assert.deepEqual(data.all_products__labels,['สินค้าชิ้นที่ 1','สินค้าชิ้นที่ 2','สินค้าชิ้นที่ 3','สินค้าชิ้นที่ 4','สินค้าชิ้นที่ 5']);
 await api('/api/data/list_customers','POST',{name:'ไม่มี',picked:['fake']},400);await api('/api/data/list_customers','POST',{name:'ปิด',picked:['24']},400);await api('/api/data/list_customers','POST',{name:'ว่าง',picked:[]},400);await api('/api/data/list_customers','POST',{picked:[{}]},400);
 await api('/api/tables','POST',{name:'list_sales',label:'รายการขาย',columns:[{name:'name',label:'ชื่อรายการ',type:'text'},{name:'customer',label:'ลูกค้า',type:'ref',ref_table:'list_customers'}]});
 const second=(await api('/api/data/list_customers','POST',{name:'อีกคน'})).id;
 const fixture=new Database(process.env.NOCODE_TEST_DB);try{fixture.transaction(()=>{const insert=fixture.prepare('INSERT INTO t_list_sales(name,customer) VALUES(?,?)');for(let i=1;i<=23;i++)insert.run('การขาย '+i,customer);insert.run('ของอีกคน',second);})();assert.ok(fixture.prepare("EXPLAIN QUERY PLAN SELECT * FROM t_list_sales WHERE customer=? ORDER BY id LIMIT 5").all(customer).some(r=>r.detail.includes('_ref_')));}finally{fixture.close();}
 const related=`/api/lists/list_sales?mode=related&owner=list_customers&id=${customer}&column=customer`;
 let result=await api(related);assert.equal(result.total,23);assert.equal(result.rows.length,5);assert.equal(result.pages,5);assert.equal(result.rows[0].label,'การขาย 1');
 result=await api(related+'&page=2');assert.equal(result.rows[0].label,'การขาย 6');
 for(const n of [5,10,20,0]){result=await api(related+'&limit='+n);assert.equal(result.rows.length,n||23);assert.equal(result.total,23);}
 result=await api(related+'&page=99');assert.equal(result.page,5);assert.equal(result.rows.length,3);
 assert.equal((await api('/api/lists/list_sales?mode=related&owner=list_customers&id='+second+'&column=customer')).total,1);
 await api('/api/tables/list_sales','PATCH',{op:'edit_column',name:'customer',list_limit:10});result=await api(related);assert.equal(result.rows.length,10);
 const meta=(await api('/api/tables')).find(t=>t.name==='list_customers');assert.equal(meta.related[0].list_limit,10);
 for(const query of ['&limit=-1','&limit=500','&page=0','&page=1.5'])await api(related+query,'GET',undefined,400);
 await api('/api/lists/list_sales?mode=related&owner=list_products&id=1&column=customer','GET',undefined,400);
 await api('/api/lists/list_sales?mode=related&owner=list_customers&id=999999&column=customer','GET',undefined,400);
 await api('/api/lists/list_sales?mode=related&owner=list_customers&id=1&column=customer%22%20OR%201=1','GET',undefined,400);
 const list=`/api/lists/list_products?mode=list&owner=list_customers&id=${customer}&column=all_products`;
 result=await api(list+'&page=2');assert.equal(result.rows.length,5);assert.equal(result.total,601);assert.equal(result.rows[0].key,'6');
 result=await api(list+'&limit=0');assert.equal(result.rows.length,601);
 result=await api('/api/lists/list_products?limit=5','POST',{keys:['1','12','601']});assert.deepEqual(result.rows.map(r=>r.key),['1','12','601']);
 await api('/api/lists/list_products','POST',{keys:[{}]},400);
 await api('/api/data/list_products?id=1','DELETE',undefined,400);
 await api('/api/actions','POST',{name:'list_delete',label:'ลบสินค้า',table_name:'list_products',kind:'delete',condition_expr:'TRUE',values:{},confirmation:''});
 await api('/api/actions','POST',{op:'execute',name:'list_delete',id:1},400);
 await api('/api/tables/list_products','PATCH',{op:'edit_column',name:'code',is_key:false});
 await api('/api/tables/list_customers','PATCH',{op:'edit_column',name:'picked',list_limit:7},400);
 await api('/api/tables/list_customers','PATCH',{op:'edit_column',name:'notes',ref_table:'list_products'},400);
 await api('/api/tables/list_customers','PATCH',{op:'edit_column',name:'picked',ref_table:''});await api('/api/tables/list_customers','PATCH',{op:'edit_column',name:'picked',ref_table:'list_products'});
 await api('/api/tables/list_products','PATCH',{op:'rename_column',name:'code',new_name:'product_code'});
 assert.equal((await api(list)).rows[0].label,'สินค้าชิ้นที่ 1');
 await api('/api/tables/list_sales','PATCH',{op:'rename_column',name:'customer',new_name:'client'});
 assert.equal((await api(related.replace('column=customer','column=client'))).total,23);
 await api('/api/tables/list_customers','PATCH',{op:'add_column',column:{name:'spare',label:'ชั่วคราว',type:'text'}});await api('/api/tables/list_customers','PATCH',{op:'drop_column',name:'spare'});
 data=(await api('/api/data/list_customers?id='+customer))[0];assert.deepEqual(data.picked,['1','2']);
 await api('/api/tables/list_sales','PATCH',{op:'drop_column',name:'client'});assert.deepEqual((await api('/api/tables')).find(t=>t.name==='list_customers').related,[]);
 await api('/api/tables/list_products','DELETE',undefined,400);
});
