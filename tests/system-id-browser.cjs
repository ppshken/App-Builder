const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(url,method='GET',body){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:940},locale:'th-TH'}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='PATCH')writes.push(r.url());});fs.mkdirSync('artifacts',{recursive:true});
 try{
  await api('/api/tables','POST',{name:'system_id_items',label:'สินค้า',columns:[{name:'code',label:'รหัสสินค้า',type:'text',is_key:true},{name:'name',label:'ชื่อสินค้า',type:'text',is_label:true}]});
  const before=(await api('/api/tables')).find(t=>t.name==='system_id_items');
  await page.goto(base+'/t/system_id_items/edit');const grid=page.getByRole('region',{name:'ตารางจัดการคอลัมน์',exact:true}),id=grid.getByRole('row',{name:'คอลัมน์ id รหัสภายในอัตโนมัติ',exact:true});
  await expect(grid.locator('tbody tr').first()).toHaveAttribute('class','system-column-row');await expect(id.getByLabel('ชื่อในระบบ id',{exact:true})).toHaveValue('id');
  await expect(id.getByRole('checkbox',{name:'Key อัตโนมัติ id',exact:true})).toBeChecked();await expect(id.getByRole('checkbox',{name:'แก้ไขได้ id',exact:true})).not.toBeChecked();await expect(id.getByRole('checkbox',{name:'ห้ามซ้ำ id',exact:true})).toBeChecked();await expect(id.getByRole('checkbox',{name:'จำเป็น id',exact:true})).toBeChecked();
  assert.equal(await id.locator('input:not(:disabled)').count(),0);await expect(id.getByRole('button')).toHaveCount(0);await expect(id).toContainText('Auto');await expect(grid.locator('tbody tr').nth(1).locator('.row-index')).toHaveText('2');await expect(grid.getByRole('checkbox',{name:'Key รหัสสินค้า',exact:true})).toBeChecked();await expect(grid.getByRole('button',{name:'แก้ไขคอลัมน์ รหัสสินค้า',exact:true})).toBeEnabled();
  await page.screenshot({path:'artifacts/system-id-columns-desktop.png'});
  const search=page.getByRole('textbox',{name:'ค้นหาคอลัมน์',exact:true});await search.fill('id');await expect(grid.locator('tbody tr')).toHaveCount(1);await expect(page.getByText('ไม่พบคอลัมน์ที่ค้นหา',{exact:true})).toHaveCount(0);await search.fill('ชื่อสินค้า');await expect(id).toHaveCount(0);await expect(grid.locator('.row-index')).toHaveText('3');await search.fill('ไม่มีคอลัมน์นี้');await expect(page.getByText('ไม่พบคอลัมน์ที่ค้นหา',{exact:true})).toBeVisible();await search.fill('');
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await expect(id).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await grid.evaluate(el=>el.scrollWidth>el.clientWidth),true);await page.screenshot({path:'artifacts/system-id-columns-mobile.png'});
  assert.deepEqual((await api('/api/tables')).find(t=>t.name==='system_id_items'),before);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('System id UI passed: first locked row, checked Key Auto/required/unique, existing business Key still editable, stable row numbers/search, mobile/dark, no metadata writes.');
 }catch(e){await page.screenshot({path:'artifacts/system-id-columns-failure.png'});throw e;}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
