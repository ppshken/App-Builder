const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(url,method='GET',body,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 await api('/api/tables','POST',{name:'tab_parent',label:'Parent',columns:[{name:'name',label:'Name',type:'text',is_label:true},{name:'status',label:'Status',type:'text'},{name:'notes',label:'Notes',type:'text'}]});const row=await api('/api/data/tab_parent','POST',{name:'Sample inspection',status:'Passed',notes:'Check completed'});
 await api('/api/tables','POST',{name:'tab_child',label:'Related checks',columns:[{name:'title',label:'Title',type:'text',is_label:true},{name:'parent',label:'Parent',type:'ref',ref_table:'tab_parent'}]});await api('/api/data/tab_child','POST',{title:'Child item',parent:row.id});
 const detail=(await api('/api/views')).find(v=>v.table_name==='tab_parent'&&v.kind==='detail');
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/views?view='+detail.name);const editor=page.getByRole('region',{name:'ตั้งค่า View',exact:true});await editor.getByRole('tab',{name:'รูปแบบหน้าจอ',exact:true}).click();
 await editor.getByLabel('เปิดใช้แท็บรายละเอียด',{exact:true}).check();await editor.getByLabel('ชื่อแท็บ 2',{exact:true}).fill('ผลตรวจ');await editor.getByLabel('ชื่อแท็บ 3',{exact:true}).fill('รายการตรวจ');
 const preview=page.frameLocator('iframe[title="ตัวอย่างแอป"]');await expect(preview.getByRole('tab',{name:/ผลตรวจ/})).toBeVisible();
 await page.getByRole('button',{name:'บันทึก View',exact:true}).click();await expect(page.locator('.designer-save-state')).toHaveText('บันทึก View แล้ว');
 let saved=(await api('/api/views')).find(v=>v.name===detail.name);assert.equal(saved.display.detail_tabs.length,3);
 await api('/api/views','PUT',{...saved,display:{...saved.display,detail_tabs:[...saved.display.detail_tabs,{id:'tab_bad',label:'Bad',fields:['name']}]}},400);
 await page.goto(base+'/run?view='+detail.name+'&row='+row.id);const tabs=page.locator('.runtime-route:not([hidden]) .detail-tabs'),panel=tabs.locator('[role="tabpanel"]:not([hidden])');
 await expect(tabs.getByRole('tab')).toHaveCount(3);await expect(panel).toContainText('Sample inspection');await expect(panel).not.toContainText('Check completed');
 await tabs.getByRole('tab',{name:/ผลตรวจ/}).click();await expect(panel).toContainText('Check completed');await expect(panel).not.toContainText('Sample inspection');
 await tabs.getByRole('tab',{name:/รายการตรวจ/}).click();await expect(panel).toContainText('Child item');await page.keyboard.press('ArrowLeft');await expect(tabs.getByRole('tab',{name:/ผลตรวจ/})).toHaveAttribute('aria-selected','true');
 fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/detail-tabs-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/detail-tabs-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await api('/api/tables/tab_parent','PATCH',{op:'rename_column',name:'notes',new_name:'memo'});await api('/api/tables/tab_child','PATCH',{op:'rename_column',name:'parent',new_name:'parent_new'});
 saved=(await api('/api/views')).find(v=>v.name===detail.name);assert(saved.display.detail_tabs[1].fields.includes('memo'));assert(saved.display.detail_tabs[2].fields.includes('related:tab_child:parent_new'));
 await api('/api/views','PUT',{...saved,display:{...saved.display,detail_tabs_style:'pills'}});await page.reload();await expect(page.locator('.runtime-route:not([hidden]) .detail-tabs')).toHaveClass(/detail-tabs-pills/);
 expect(errors).toEqual([]);console.log('Detail tabs passed: editor enable/rename/save, validation, visible field groups, Related, keyboard, mobile overflow, column/Ref rename and pill style.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
