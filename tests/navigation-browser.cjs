const {selectChoice,assertControlValue}=require("./dropdown-helpers.cjs");
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(route,method='GET',body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
async function main(){const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await api('/api/tables','POST',{name:'nav_parent',label:'ลูกค้า',columns:[{name:'name',label:'ชื่อ',type:'text',is_label:true}]});
 const parent=await api('/api/data/nav_parent','POST',{name:'ลูกค้าหนึ่ง'});
 await api('/api/tables','POST',{name:'nav_child',label:'งาน',columns:[{name:'name',label:'ชื่องาน',type:'text',is_label:true},{name:'customer',label:'ลูกค้า',type:'ref',ref_table:'nav_parent'}]});
 const child=await api('/api/data/nav_child','POST',{name:'งานหนึ่ง',customer:parent.id});
 const views=await api('/api/views'),find=(table,kind)=>views.find(v=>v.table_name===table&&v.kind===kind&&v.position!=='inline'),list=find('nav_parent','list'),pd=find('nav_parent','detail'),cd=find('nav_child','detail');
 await page.goto(base+'/run?view='+list.name);
 await page.getByRole('button',{name:'ดูรายละเอียด ลูกค้าหนึ่ง',exact:true}).click();
 await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('ลูกค้าหนึ่ง');
 await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();
 await page.getByLabel('ชื่อ',{exact:true}).fill('ลูกค้าแก้ไขแล้ว');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
 await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('ลูกค้าแก้ไขแล้ว');await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen .success-banner')).toHaveText('บันทึกข้อมูลแล้ว');await expect(page).toHaveURL(new RegExp('view='+pd.name));
 // Brand overrides cannot recolor success, including dark mode.
 const banner=page.locator('.runtime-route:not([hidden]) .runtime-screen .success-banner');
 for(const mode of ['light','dark'])for(const color of ['#2563eb','#7c3aed','#be185d','#b45309','#ff0000']){await page.evaluate(({mode,color})=>{document.documentElement.dataset.mode=mode;document.documentElement.style.setProperty('--accent',color);document.documentElement.style.setProperty('--accent-soft',color);},{mode,color});expect(await banner.evaluate(el=>getComputedStyle(el).color)).toBe(mode==='light'?'rgb(22, 101, 52)':'rgb(134, 239, 172)');}
 fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/navigation-success-dark.png'});
 await page.getByRole('button',{name:'งานหนึ่ง ↗',exact:true}).click();await expect(page).toHaveURL(new RegExp('view='+cd.name));await expect(page.locator('.runtime-transition')).toHaveAttribute('aria-busy','false');
 await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await page.getByLabel('ชื่องาน',{exact:true}).fill('งานแก้ไขแล้ว');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('งานแก้ไขแล้ว');await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen .success-banner')).toHaveText('บันทึกข้อมูลแล้ว');
 await page.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).click();await expect(page).toHaveURL(new RegExp('view='+pd.name));await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('ลูกค้าแก้ไขแล้ว');await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('งานแก้ไขแล้ว');
 // Browser Back preserves dirty forms until explicitly discarded.
 await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await page.getByLabel('ชื่อ',{exact:true}).fill('ยังไม่บันทึก');await page.goBack();await expect(page.getByRole('dialog',{name:'ยังไม่ได้บันทึกข้อมูล'})).toBeVisible();await page.getByRole('button',{name:'กลับไปกรอกต่อ',exact:true}).click();await assertControlValue(page.getByLabel('ชื่อ',{exact:true}),'ยังไม่บันทึก');
 await page.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).filter({has:page.locator('svg')}).last().click();await page.getByRole('button',{name:'ปิดโดยไม่บันทึก',exact:true}).click();await expect(page).toHaveURL(new RegExp('view='+pd.name));await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toContainText('ลูกค้าแก้ไขแล้ว');
 await page.getByRole('button',{name:'กลับหน้าก่อนหน้า',exact:true}).click();await expect(page).toHaveURL(new RegExp('view='+list.name));await expect(page.locator('.runtime-route:not([hidden]) .runtime-screen')).toHaveCount(0);
 // The Data editor also restores the detail dialog after saving.
 await page.goto(base+'/t/nav_child');await page.getByRole('button',{name:'ดูรายละเอียด งานแก้ไขแล้ว',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await page.getByLabel('ชื่องาน',{exact:true}).fill('งานใน Data');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('งานใน Data');await expect(page.getByRole('dialog').locator('.success-banner')).toHaveText('บันทึกข้อมูลแล้ว');
 expect(errors).toEqual([]);console.log('Navigation browser passed: green success, detail edit/save, nested references/back, unsaved Browser Back protection, Data dialog.');
 }finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
