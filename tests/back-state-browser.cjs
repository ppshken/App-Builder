const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const {selectChoice,assertControlValue}=require('./dropdown-helpers.cjs');
const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
async function main(){
 await api('/api/tables','POST',{name:'back_items',label:'Items',columns:[{name:'name',label:'ชื่อ',type:'text',is_label:true}]});
 for(let i=0;i<60;i++)await api('/api/data/back_items','POST',{name:'Item '+i});
 const views=await api('/api/views');let list=views.find(v=>v.table_name==='back_items'&&v.kind==='list');if(process.env.NOCODE_TEST_TABLE){list={...list,name:'back_table',kind:'table'};await api('/api/views','POST',list);}
 const browser=await chromium.launch({channel:process.env.NOCODE_TEST_BROWSER||'msedge',headless:true}),outerPage=await browser.newPage({viewport:{width:process.env.NOCODE_TEST_DESKTOP?1440:390,height:844}});let page=outerPage;page.setDefaultTimeout(20000);
 let listRequests=0;page.on('request',r=>{if(r.method()==='GET'&&r.url().includes('/api/data/back_items?q='))listRequests++;});
 const active=()=>page.locator('.runtime-route:not([hidden])');
 try{
 if(process.env.NOCODE_TEST_PREVIEW){await outerPage.goto(base+'/views?view='+list.name);await outerPage.getByRole('button',{name:'คอมพิวเตอร์',exact:true}).click();await expect(outerPage.locator('iframe')).toBeVisible();page=await outerPage.locator('iframe[title="ตัวอย่างแอป"]').elementHandle().then(el=>el.contentFrame());await expect(page.locator('.runtime-app')).toHaveClass(/runtime-desktop/);}else await page.goto(base+'/run?view='+list.name);await expect(active().locator('.record-card')).toHaveCount(25);
 await selectChoice(active().getByLabel('รายการต่อหน้า',{exact:true}),'50');await expect(active().locator('.record-card')).toHaveCount(50);
 await page.evaluate(()=>window.scrollTo(0,1500));await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(1500);
 await expect.poll(()=>active().locator('.data-toolbar').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(60);
 await page.evaluate(()=>{window.navigationScrollSamples=[];window.monitorNavigationScroll=true;const sample=()=>{if(!window.monitorNavigationScroll)return;window.navigationScrollSamples.push(window.scrollY);requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const before=listRequests;
 const target=await active().locator(process.env.NOCODE_TEST_TABLE?'.record-table .record-link':'.record-card-main').evaluateAll(buttons=>{const button=buttons.find(el=>{const r=el.getBoundingClientRect();return r.top>140&&r.bottom<window.innerHeight-100;});if(!button)throw Error('No visible record');return button.getAttribute('aria-label');});
 await active().getByRole('button',{name:target,exact:true}).click();await expect(active().locator('.runtime-screen')).toBeVisible();
 if(process.env.NOCODE_TEST_DESKTOP){await expect(page.locator('.runtime-background .record-card')).toHaveCount(50);await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(1500);}
 await page.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).click();await expect(active().locator('.record-card')).toHaveCount(50);
 await assertControlValue(active().getByLabel('รายการต่อหน้า',{exact:true}),'50');await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(1500);assert.equal(listRequests,before);await page.evaluate(()=>window.monitorNavigationScroll=false);if(process.env.NOCODE_TEST_DESKTOP)assert.ok(await page.evaluate(()=>window.navigationScrollSamples.every(top=>Math.abs(top-1500)<=1)),'Navigation must not briefly jump to top');
 await active().getByRole('button',{name:target,exact:true}).click();await expect(active().locator('.runtime-screen')).toBeVisible();await page.evaluate(()=>history.back());await expect(active().locator('.record-card')).toHaveCount(50);await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(1500);assert.equal(listRequests,before);
 await active().getByRole('button',{name:target,exact:true}).click();await expect(active().locator('.runtime-screen')).toBeVisible();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await page.getByLabel('ชื่อ',{exact:true}).fill('Changed item');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(active().locator('.runtime-screen')).toContainText('Changed item');await page.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).click();await expect(active().getByRole('button',{name:'ดูรายละเอียด Changed item',exact:true})).toBeVisible();await assertControlValue(active().getByLabel('รายการต่อหน้า',{exact:true}),'50');assert.ok(listRequests>before);
 console.log((process.env.NOCODE_TEST_PREVIEW?'Desktop iframe: ':'')+'Back state passed: 50 rows, scroll restoration, button/browser back without list requests, refresh after edit.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
