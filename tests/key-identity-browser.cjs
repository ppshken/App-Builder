const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(url,method='GET',body,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:940},locale:'th-TH',reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts',{recursive:true});
 try{
  await api('/api/tables','POST',{name:'identity_products',label:'สินค้า',columns:[{name:'code',label:'รหัสสินค้า',type:'text',is_key:true},{name:'name',label:'ชื่อสินค้า',type:'text',is_label:true}]});
  const db=new Database(process.env.NOCODE_TEST_DB);try{db.prepare('INSERT INTO t_identity_products(id,code,name) VALUES(?,?,?)').run(17,'P001','ปากกา');db.prepare('INSERT INTO t_identity_products(id,code,name) VALUES(?,?,?)').run(23,'P002','สมุด');}finally{db.close();}
  await api('/api/tables','POST',{name:'identity_orders',label:'รายการขาย',columns:[{name:'name',label:'รายการ',type:'text',is_label:true},{name:'product',label:'สินค้า',type:'ref',ref_table:'identity_products'},{name:'picked',label:'สินค้าที่เลือก',type:'list',ref_table:'identity_products',valid_if:'SELECT(identity_products[code], TRUE)',default_expr:'SELECT(identity_products[code], [code]="P001")'},{name:'tags',label:'รหัสหลายรายการ',type:'enumlist',valid_if:'identity_products[code]'},{name:'all_items',label:'สินค้าทั้งหมด',type:'list',ref_table:'identity_products',is_virtual:true,virtual_expr:'IF(TRUE, identity_products[code], LIST())'}]});
  const owner=(await api('/api/data/identity_orders','POST',{name:'รายการแรก',product:17,tags:['P001']})).id;
  let row=(await api('/api/data/identity_orders?id='+owner))[0];assert.deepEqual(row.picked,['17']);assert.deepEqual(row.all_items,['17','23']);assert.deepEqual(row.picked__labels,['ปากกา']);
  await api('/api/data/identity_orders?id='+owner,'PUT',{picked:['P001']},400);
  await api('/api/data/identity_products','POST',{id:99,code:'P003'},400);await api('/api/data/identity_products?id=17','PUT',{id:99},400);
  await page.goto(base+'/t/identity_products');await page.getByRole('button',{name:'มุมมองตาราง',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:/id · รหัสภายใน/})).toBeVisible();await expect(page.getByRole('columnheader',{name:/รหัสสินค้า · Key/})).toBeVisible();
  const dataRow=page.getByRole('row',{name:'ดูรายละเอียดแถว ปากกา',exact:true});await expect(dataRow.locator('td').first()).toHaveText('17');
  await page.screenshot({path:'artifacts/key-identity-data.png'});
  await page.getByRole('button',{name:'แก้ไข ปากกา',exact:true}).click();let form=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});await expect(form.getByLabel(/^รหัสสินค้า/)).toBeEnabled();await expect(form.locator('.internal-id-note')).toContainText('17');
  await form.getByLabel(/^รหัสสินค้า/).fill('PEN001');await form.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(form).toHaveCount(0);
  row=(await api('/api/data/identity_orders?id='+owner))[0];assert.equal(row.product,17);assert.deepEqual(row.picked,['17']);assert.deepEqual(row.tags,['PEN001']);assert.equal(row.product__label,'ปากกา');assert.deepEqual(row.all_items,['17','23']);assert.equal((await api('/api/data/identity_products?id=17'))[0].__key,'PEN001');
  await api('/api/data/identity_products?id=17','PUT',{code:'P002'},400);await api('/api/data/identity_products?id=17','PUT',{code:' '},400);assert.equal((await api('/api/data/identity_products?id=17'))[0].code,'PEN001');
  await api('/api/data/identity_products?id=17','DELETE',undefined,400);
  await page.goto(base+'/t/identity_orders');await page.getByRole('button',{name:'แก้ไข รายการแรก',exact:true}).click();form=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});
  const list=form.getByRole('region',{name:'สินค้าที่เลือก',exact:true});await expect(list.getByRole('checkbox',{name:'ปากกา',exact:true})).toBeChecked();await expect(list).toContainText('PEN001');
  await form.getByRole('combobox',{name:'สินค้า',exact:true}).click();const choice=page.locator('.search-select-dialog');await choice.getByRole('searchbox').fill('PEN001');await expect(choice.getByRole('option',{name:'ปากกา · PEN001',exact:true})).toBeVisible();await page.keyboard.press('Escape');await form.getByRole('button',{name:'ยกเลิก',exact:true}).click();
  await api('/api/tables/identity_products','PATCH',{op:'edit_column',name:'code',is_editable:false});await api('/api/data/identity_products?id=17','PUT',{code:'LOCKED'},400);await api('/api/tables/identity_products','PATCH',{op:'edit_column',name:'code',is_editable:true});
  await api('/api/actions','POST',{name:'identity_rename',label:'เปลี่ยนรหัส',table_name:'identity_products',kind:'set',condition_expr:'TRUE',values:{code:'"PEN002"'},confirmation:''});await api('/api/actions','POST',{op:'execute',name:'identity_rename',id:17});row=(await api('/api/data/identity_orders?id='+owner))[0];assert.deepEqual(row.tags,['PEN002']);assert.deepEqual(row.picked,['17']);
  await api('/api/tables/identity_products','PATCH',{op:'edit_column',name:'name',is_key:true});assert.deepEqual((await api('/api/data/identity_orders?id='+owner))[0].picked,['17']);
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.goto(base+'/t/identity_products');await page.getByRole('button',{name:'ดูรายละเอียด ปากกา',exact:true}).click();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();form=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});await expect(form.getByLabel(/^ชื่อสินค้า/)).toBeEnabled();await expect(form.locator('.internal-id-note')).toContainText('17');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/key-identity-mobile.png'});
  assert.deepEqual(errors,[]);console.log('Identity passed: real id shown, editable Key, Ref/List stable across Key edits and replacement, SELECT/default/virtual ids, EnumList cascade, labels/codes in choices, uniqueness/readonly/id guards, Actions, mobile/dark.');
 }catch(e){await page.screenshot({path:'artifacts/key-identity-failure.png'});console.error(await page.locator('body').innerText());throw e;}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
