const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body,status=200,cookie){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
async function upload(){const form=new FormData();form.append('table','product_image');form.append('column','image');form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB7sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'photo.png');const response=await fetch(base+'/api/images',{method:'POST',body:form}),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data.url;}
(async()=>{
 await api('/api/tables','POST',{name:'products',label:'Products',columns:[{name:'name',label:'Name',type:'text',is_label:true}]});
 await api('/api/tables','POST',{name:'product_image',label:'Product Images',columns:[{name:'product_id',label:'Product',type:'ref',ref_table:'products'},{name:'image',label:'Image',type:'image'},{name:'parent_name',label:'Parent name',type:'text',is_virtual:true,virtual_expr:'[product_id].[name]'}]});
 const first=(await api('/api/data/products','POST',{name:'First Product'})).id,second=(await api('/api/data/products','POST',{name:'Second Product'})).id;
 const images=[await upload(),await upload(),await upload()];
 for(const [index,product_id] of [first,first,second].entries())await api('/api/data/product_image','POST',{product_id,image:images[index]});
 for(const column of [
  {name:'images',label:'Images',type:'list',is_virtual:true,virtual_expr:'[Related_product_image][image]'},
  {name:'cover',label:'Cover',type:'image',is_virtual:true,virtual_expr:'INDEX([Related_product_image][image], 1)'},
  {name:'image_count',label:'Image Count',type:'number',is_virtual:true,virtual_expr:'COUNT([Related_product_image])'}
 ])await api('/api/tables/products','PATCH',{op:'add_column',column});
 let rows=await api('/api/data/products?sort=id&dir=asc');
 assert.deepEqual(rows[0].images,images.slice(0,2));assert.equal(rows[0].cover,images[0]);assert.equal(rows[0].image_count,2);assert.deepEqual(rows[1].images,[images[2]]);
 const snapshots=await api('/api/expression-data?table=products');assert.ok(snapshots.product_image.rows.every(r=>!Object.hasOwn(r,'parent_name')));
 await api('/api/tables/product_image','PATCH',{op:'drop_column',name:'image'},400);
 await api('/api/tables/product_image','PATCH',{op:'drop_column',name:'product_id'},400);
 await api('/api/tables/product_image','PATCH',{op:'rename_column',name:'image',new_name:'photo'});
 let meta=(await api('/api/tables')).find(t=>t.name==='products');assert.equal(meta.columns.find(c=>c.name==='images').virtual_expr,'[Related_product_image][photo]');
 assert.deepEqual((await api('/api/data/products?id='+first))[0].images,images.slice(0,2));
 await api('/api/tables','POST',{name:'image_categories',columns:[{name:'name',type:'text'}]});
 await api('/api/tables/product_image','PATCH',{op:'add_column',column:{name:'category',type:'ref',ref_table:'image_categories'}});
 // Related must work in persisted Action values as in virtual columns.
 await api('/api/tables/products','PATCH',{op:'add_column',column:{name:'saved_count',label:'Saved count',type:'number'}});
 for(const mode of ['snapshot','sequential']){
  const action={name:'related_count_'+mode,label:'Related count '+mode,table_name:'products',kind:'set',condition_expr:'TRUE',values:{saved_count:'COUNT([Related_product_image])'},confirmation:'',config:{value_mode:mode}};
  await api('/api/actions','POST',action);
  await api('/api/actions','POST',{op:'execute',name:action.name,id:first});
  assert.equal((await api('/api/data/products?id='+first))[0].saved_count,2);
  await api('/api/actions','POST',{op:'execute',name:action.name,id:second});
  assert.equal((await api('/api/data/products?id='+second))[0].saved_count,1);
 }
 for(const name of ['groups_weight','groups_score','inspection_categories_id'])await api('/api/tables/product_image','PATCH',{op:'add_column',column:{name,type:'number'}});
 const children=await api('/api/data/product_image?sort=id&dir=asc');
 for(const [index,child] of children.entries())await api('/api/data/product_image?id='+child.id,'PUT',{groups_weight:2,groups_score:index===0?1:2,inspection_categories_id:1});
 await api('/api/tables/products','PATCH',{op:'add_column',column:{name:'saved_score',type:'decimal'}});
 const denominator='SUM(SELECT([Related_product_image][groups_weight], [inspection_categories_id] = 1))',numerator='SUM(SELECT([Related_product_image][groups_score], [inspection_categories_id] = 1))',score='IF('+denominator+' = 0, 0, '+numerator+' / '+denominator+')';
 await api('/api/tables/products','PATCH',{op:'add_column',column:{name:'virtual_score',type:'decimal',is_virtual:true,virtual_expr:score}});
 await api('/api/actions','POST',{name:'related_score',label:'Related score',table_name:'products',kind:'set',condition_expr:'TRUE',values:{saved_score:score},confirmation:''});
 for(const id of [first,second]){await api('/api/actions','POST',{op:'execute',name:'related_score',id});const record=(await api('/api/data/products?id='+id))[0];assert.equal(record.saved_score,record.virtual_score);assert.equal(record.saved_score,id===first?0.75:1);}
 const empty=(await api('/api/data/products','POST',{name:'No children'})).id;await api('/api/actions','POST',{op:'execute',name:'related_score',id:empty});assert.equal((await api('/api/data/products?id='+empty))[0].saved_score,0);
 const browser=await chromium.launch({channel:process.env.NOCODE_BROWSER_CHANNEL||'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/t/products');await page.getByRole('button',{name:'แก้ไข First Product',exact:true}).click();
  const form=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});
  await expect(form.locator('#data-image_count')).toHaveText('2');
  await expect(form.locator('#data-cover img')).toHaveAttribute('src',new RegExp('^'+images[0]+'(?:[?]|$)'));
  await form.getByLabel('Name',{exact:true}).fill('Renamed Product');
  await expect(form.locator('#data-image_count')).toHaveText('2');
  await form.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(form).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});const detail=(await api('/api/views')).find(v=>v.table_name==='products'&&v.kind==='detail');
  await page.goto(base+'/run?view='+detail.name+'&row='+first);
  await expect(page.locator('.detail-fields')).toContainText('2');
  await expect(page.locator('.detail-fields img[src^="'+images[0]+'"]')).toBeVisible();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 const rights={read:true,create:false,update:false,delete:false};
 const role=await api('/api/users','POST',{op:'create_role',label:'Related reader',builder:false,tables:{products:rights,product_image:rights},actions:[],row_rules:{'product_image:read':'[id] = 2'}});
 await api('/api/users','POST',{op:'create_user',name:'Related Reader',email:'related@example.test',password:'RelatedPassword123',role:role.name,active:true});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie:'none=1'},body:JSON.stringify({email:'related@example.test',password:'RelatedPassword123'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 rows=await api('/api/data/products?sort=id&dir=asc','GET',undefined,200,cookie);assert.deepEqual(rows[0].images,[images[1]]);assert.deepEqual(rows[1].images,[]);assert.equal(rows[0].image_count,1);
 console.log('Related expressions passed: parent/child isolation, images, INDEX/COUNT, projections, rename/delete guards, live browser form, mobile details and row permissions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
