const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {selectChoice}=require('./dropdown-helpers.cjs');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
(async()=>{
 await api('/api/tables','POST',{name:'designer_jobs',label:'ใบงานตัวอย่าง',columns:[{name:'name',label:'ชื่องาน',type:'text'},{name:'status',label:'สถานะ',type:'text'},{name:'amount',label:'จำนวน',type:'number'},{name:'report',label:'รายงาน',type:'file'},{name:'double',label:'ค่าคำนวณ',type:'number',is_virtual:true,virtual_expr:'[amount] * 2'}]});
 await api('/api/actions','POST',{name:'designer_done',label:'ปิดใบงาน',table_name:'designer_jobs',kind:'set',condition_expr:'TRUE',values:{status:'"Done"'},confirmation:''});
 await api('/api/pdf-templates','POST',{name:'designer_pdf',label:'รายงานใบงาน',table_name:'designer_jobs',title_expr:'"Report"',columns:['name','amount'],orientation:'portrait',related:[]});
 const workflow={name:'designer_flow',label:'ขั้นตอนใบงาน',table_name:'designer_jobs',enabled:false,event:'update',condition_expr:'TRUE',watch_columns:['status'],interval_minutes:60,steps:[{kind:'action',action_name:'designer_done'},{kind:'webhook',url:'https://example.com/mock-only',method:'POST',bearer_env:'',payload:{id:'[id]'},response_values:{}},{kind:'pdf',template_name:'designer_pdf',filename_expr:'"Report"',output_column:'report'}]};
 await api('/api/workflows','POST',workflow);
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/workflows?name=designer_flow');
  const save=page.getByRole('button',{name:'บันทึก Automation',exact:true}),canvas=page.getByRole('region',{name:'แผนผัง Automation',exact:true});
  await expect(canvas).toBeVisible();await expect(save).toBeDisabled();
  const events=page.getByRole('group',{name:'เมื่อไหร่',exact:true});
  for(const label of ['กดปุ่มหรือสั่งทำงาน','เมื่อเพิ่มข้อมูล','เมื่อแก้ไขข้อมูล','เมื่อลบข้อมูล','ตามเวลา']){
   const button=events.getByRole('button',{name:label,exact:true});await button.click();await expect(button).toHaveAttribute('aria-pressed','true');assert.ok(await button.locator('svg').count());
  }
  await page.locator('#workflow-interval').fill('90');
  await events.getByRole('button',{name:'เมื่อแก้ไขข้อมูล',exact:true}).click();
  const watch=page.getByRole('group',{name:'คอลัมน์ที่เฝ้าดู',exact:true});
  await expect(watch.getByRole('checkbox')).toHaveCount(4);await expect(watch).not.toContainText('ค่าคำนวณ');
  await watch.getByRole('checkbox',{name:'จำนวน amount',exact:true}).check();
  const boxes=await watch.locator('label').evaluateAll(labels=>labels.map(l=>({x:l.getBoundingClientRect().x,y:l.getBoundingClientRect().y})));
  assert(boxes.every((b,i)=>!i||b.y>boxes[i-1].y&&Math.abs(b.x-boxes[0].x)<1),'Watched columns must have separate vertical rows');
  await page.getByRole('button',{name:'ตั้งค่าเงื่อนไข',exact:true}).click();
  const formula=page.getByRole('button',{name:'แก้ไขสูตร ถ้า · เงื่อนไขการทำงาน',exact:true});await formula.click();
  let modal=page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true});await modal.locator('#assistant-source').fill('[amount] > 99');await modal.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(formula).toContainText('TRUE');
  await formula.click();modal=page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true});await modal.locator('#assistant-source').fill('[missing] > 5');await expect(modal.getByRole('button',{name:'ใช้สูตรนี้',exact:true})).toBeDisabled();await modal.locator('#assistant-source').fill('[amount] > 5');await modal.getByRole('button',{name:'ใช้สูตรนี้',exact:true}).click();await expect(formula).toContainText('[amount] > 5');
  await page.getByRole('button',{name:'ตั้งค่าขั้นตอน 2',exact:true}).click();
  await page.getByRole('button',{name:'แก้ไขสูตร ค่าของ id ขั้นตอน 2',exact:true}).click();modal=page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true});await modal.locator('#assistant-source').fill('LIST("first", "second")');await modal.getByRole('tab',{name:'ลองคำนวณ',exact:true}).click();await modal.getByRole('button',{name:'ทดสอบสูตร',exact:true}).click();await expect(modal.locator('.result-box')).toContainText('["first","second"]');await modal.getByRole('button',{name:'ใช้สูตรนี้',exact:true}).click();
  await page.getByRole('button',{name:'เลื่อนขั้นตอน 2 ขึ้น',exact:true}).click();await expect(page.locator('#step-url-0')).toHaveValue('https://example.com/mock-only');await page.getByRole('button',{name:'เลื่อนขั้นตอน 1 ลง',exact:true}).click();await expect(page.locator('#step-url-1')).toHaveValue('https://example.com/mock-only');
  await page.getByRole('button',{name:'ตั้งค่าขั้นตอน 3',exact:true}).click();await page.getByRole('button',{name:'นำขั้นตอน 3 ออก',exact:true}).click();await expect(canvas.getByRole('button',{name:'ตั้งค่าขั้นตอน 3',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'สร้างไฟล์ PDF',exact:true}).click();await selectChoice(page.locator('#step-template-2'),'designer_pdf');await selectChoice(page.locator('#step-file-2'),'report');
  await page.getByRole('button',{name:'แก้ไขสูตร ชื่อไฟล์ PDF ขั้นตอน 3',exact:true}).click();modal=page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true});await modal.locator('#assistant-source').fill('CONCATENATE("Report-", [id])');await modal.getByRole('button',{name:'ใช้สูตรนี้',exact:true}).click();
  await save.click();await expect(page.getByRole('status').filter({hasText:'บันทึกการตั้งค่าแล้ว'})).toBeVisible();await expect(save).toBeDisabled();
  const stored=(await api('/api/workflows')).find(w=>w.name===workflow.name);assert.equal(stored.event,'update');assert.deepEqual(stored.watch_columns,['status','amount']);assert.equal(stored.condition_expr,'[amount] > 5');assert.equal(stored.interval_minutes,90);assert.deepEqual(stored.steps.map(s=>s.kind),['action','webhook','pdf']);assert.equal(stored.steps[1].payload.id,'LIST("first", "second")');assert.equal(stored.steps[2].output_column,'report');assert.equal(stored.steps[2].filename_expr,'CONCATENATE("Report-", [id])');assert.equal(stored.enabled,false);
  await page.reload();await expect(canvas).toBeVisible();await page.getByRole('button',{name:'ตั้งค่าเงื่อนไข',exact:true}).click();await expect(formula).toContainText('[amount] > 5');await expect(save).toBeDisabled();
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/workflow-designer-desktop.png'});
  await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-mode','dark');await page.screenshot({path:'artifacts/workflow-designer-dark.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'ตั้งค่าเหตุการณ์',exact:true}).click();await expect(events).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'artifacts/workflow-designer-mobile.png'});
  await events.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/workflow-designer-mobile-inspector.png'});
  await page.getByRole('button',{name:'ตั้งค่าเงื่อนไข',exact:true}).click();await formula.click();await expect(page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(save).toBeDisabled();
  assert.deepEqual(errors,[]);console.log('Workflow designer passed: event buttons, vertical watched columns, formula cancel/apply/validation/any-result, ordered node edit/move/delete/add, save/reload, mobile/dark layout.');
 }catch(e){fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/workflow-designer-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
