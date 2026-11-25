const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(p,m='GET',b,status=200){const r=await fetch(base+p,{method:m,headers:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
(async()=>{
 const options=JSON.stringify({true:'ผ่าน',false:'ไม่ผ่าน'});
 await api('/api/tables','POST',{name:'boolean_labels',label:'Boolean labels',columns:[{name:'name',label:'Name',type:'text',is_label:true},{name:'approved',label:'Approved',type:'yesno',options}]});
 await api('/api/data/boolean_labels','POST',{name:'Positive',approved:true});await api('/api/data/boolean_labels','POST',{name:'Negative',approved:false});
 const views=await api('/api/views'),detail=views.find(v=>v.table_name==='boolean_labels'&&v.kind==='detail'),form=views.find(v=>v.table_name==='boolean_labels'&&v.kind==='form');
 const browser=await chromium.launch({channel:process.env.NOCODE_BROWSER_CHANNEL||'msedge',headless:true});
 try{const page=await browser.newPage();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/run?view='+form.name);
  const group=page.getByRole('group',{name:'Approved',exact:true}),labels=JSON.parse(options);
  const yes=group.getByRole('button',{name:labels.true,exact:true}),no=group.getByRole('button',{name:labels.false,exact:true});
  await expect(yes).toHaveAttribute('aria-pressed','false');await expect(no).toHaveAttribute('aria-pressed','false');
  await expect.poll(async()=>{const a=await yes.boundingBox(),b=await no.boundingBox();return !!a&&!!b&&a.x<b.x&&Math.abs(a.y-b.y)<2;}).toBe(true);
  await yes.click();await expect(yes).toHaveAttribute('aria-pressed','true');
  await no.click();await expect(yes).toHaveAttribute('aria-pressed','false');await expect(no).toHaveAttribute('aria-pressed','true');
  await no.click();await expect(no).toHaveAttribute('aria-pressed','false');
  await page.getByLabel('Name',{exact:true}).fill('Cleared '+width);
  const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/data/boolean_labels'));
  await page.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();
  assert.equal((await saved).ok(),true);
 }
 const all=await api('/api/data/boolean_labels');
 assert.equal(all.filter(row=>row.name.startsWith('Cleared ')&&row.approved===null).length,2);
 const rows=await api('/api/data/boolean_labels');for(const row of rows.filter(row=>row.approved!==null)){await page.goto(base+'/run?view='+detail.name+'&row='+row.id);await expect(page.locator('.detail-page:visible')).toContainText(row.approved?'ผ่าน':'ไม่ผ่าน');}
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/t/boolean_labels/edit');await page.getByRole('button',{name:'แก้ไขคอลัมน์ Approved',exact:true}).click();
 await page.getByLabel('ชื่อแสดงผล True',{exact:true}).fill('อนุมัติ');await page.getByLabel('ชื่อแสดงผล False',{exact:true}).fill('ปฏิเสธ');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(page.getByLabel('ชื่อแสดงผล True',{exact:true})).not.toBeVisible();
 await page.goto(base+'/run?view='+detail.name+'&row='+rows.find(r=>r.name==='Negative').id);await expect(page.locator('.detail-page:visible')).toContainText('ปฏิเสธ');
 const persisted=await api('/api/data/boolean_labels');assert.equal(persisted.find(r=>r.name==='Positive').approved,1);assert.equal(persisted.find(r=>r.name==='Negative').approved,0);
 await api('/api/tables/boolean_labels','PATCH',{op:'edit_column',name:'approved',options:'{"true":123}'},400);
 console.log('PASS custom boolean labels: persisted metadata, desktop/mobile forms, details, unchanged 1/0 values, invalid metadata rejected');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
