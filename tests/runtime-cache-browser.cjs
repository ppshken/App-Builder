
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const {selectChoice}=require('./dropdown-helpers.cjs');
const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
async function main(){
 await api('/api/tables','POST',{name:'cache_product',label:'สินค้า',columns:[{name:'name',label:'ชื่อ',type:'text',is_label:true}]});
 const product=await api('/api/data/cache_product','POST',{name:'สินค้าทดสอบ'});
 await api('/api/tables','POST',{name:'cache_cart',label:'ตะกร้า',columns:[{name:'name',label:'ชื่อ',type:'text',is_label:true},{name:'product',label:'สินค้า',type:'ref',ref_table:'cache_product'}]});
 await api('/api/data/cache_cart','POST',{name:'รายการทดสอบ',product:product.id});
 const views=await api('/api/views'),list=views.find(v=>v.table_name==='cache_cart'&&v.kind==='list'),detail=views.find(v=>v.table_name==='cache_cart'&&v.kind==='detail');
 await api('/api/views','POST',{...list,name:'cache_table',label:'ตารางตะกร้า',kind:'table',pos:99});
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),requests=[],errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='GET')requests.push(r);});
 try{
 await page.goto(base+'/views?view='+list.name);const app=page.frameLocator('iframe[title="ตัวอย่างแอป"]');
 await expect(app.locator('.runtime-route:not([hidden])').getByRole('button',{name:'ดูรายละเอียด รายการทดสอบ',exact:true})).toBeVisible();
 const frame=page.frames().find(f=>f.url().includes('/run?'));await frame.evaluate(()=>window.cacheFrameMarker='same-frame');
 const initial=requests.filter(r=>r.frame()===frame),count=url=>initial.filter(r=>new URL(r.url()).pathname+new URL(r.url()).search===url).length;
 for(const url of ['/api/tables','/api/views?runtime=1','/api/views','/api/actions','/api/slices','/api/expression-data?table=cache_cart&display=1'])assert.equal(count(url),1,url+' must deduplicate initial mounts');
 assert.equal(initial.filter(r=>new URL(r.url()).pathname==='/api/data/cache_product').length,0,'Ref choices must wait for form');
 requests.length=0;
 await selectChoice(page.getByLabel('View ที่เปิดใน Preview',{exact:true}),'cache_table');
 await expect(app.locator('.runtime-route:not([hidden]) table')).toBeVisible();
 await expect(app.locator('.runtime-transition')).toHaveAttribute('aria-busy','false');
 assert.equal(await frame.evaluate(()=>window.cacheFrameMarker),'same-frame');
 const repeated=requests.filter(r=>r.frame()===frame&&['/api/tables','/api/views','/api/actions','/api/slices','/api/expression-data'].includes(new URL(r.url()).pathname));assert.equal(repeated.length,0,repeated.map(r=>r.url()).join(', '));
 await selectChoice(page.getByLabel('View ที่เปิดใน Preview',{exact:true}),list.name);await frame.waitForURL(new RegExp('view='+list.name+'(?:&|$)'));await expect(app.locator('.runtime-transition')).toHaveAttribute('aria-busy','false');
 await expect(app.locator('.runtime-route:not([hidden])').getByRole('button',{name:'ดูรายละเอียด รายการทดสอบ',exact:true})).toBeVisible();
 await app.locator('.runtime-route:not([hidden])').getByRole('button',{name:'ดูรายละเอียด รายการทดสอบ',exact:true}).click();await expect(app.getByRole('button',{name:'แก้ไขข้อมูล',exact:true})).toBeVisible();
 await app.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await app.getByLabel('ชื่อ',{exact:true}).fill('รายการแก้ไขแล้ว');
 await expect(app.getByRole('combobox',{name:'สินค้า',exact:true})).toContainText('สินค้าทดสอบ');
 await app.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(app.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('รายการแก้ไขแล้ว');
 await expect.poll(async()=>(await api('/api/data/cache_cart'))[0].name).toBe('รายการแก้ไขแล้ว');
 await app.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).click();await expect(app.getByRole('button',{name:'ดูรายละเอียด รายการแก้ไขแล้ว',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/runtime-cache-preview.png'});
 requests.length=0;await app.getByRole('button',{name:'โหลดข้อมูลใหม่',exact:true}).click();await expect(app.locator('.runtime-transition')).toHaveAttribute('aria-busy','false');
 await expect.poll(()=>requests.filter(r=>new URL(r.url()).pathname==='/api/tables').length).toBeGreaterThan(0);
 assert.deepEqual(errors,[]);console.log('Preview cache passed: one initial metadata batch, same iframe on selection, zero repeated registry reads on same-table switch, deferred Ref choices, fresh data after edit/back, explicit refresh invalidates cache.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
