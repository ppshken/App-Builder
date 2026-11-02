const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(url,method='GET',body,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),database=new Database(process.env.NOCODE_TEST_DB);require('../.test-build/audit-schema.js').registerAuditFunctions(database);try{
 await api('/api/tables','POST',{name:'publish_ready',label:'Publish ready',columns:[{name:'name',label:'Name',type:'text'},{name:'amount',label:'Amount',type:'number'}]});
 const views=await api('/api/views'),list=views.find(v=>v.table_name==='publish_ready'&&v.kind==='list');
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/views');await page.getByRole('link',{name:'ตรวจความพร้อมก่อนเผยแพร่',exact:true}).click();
 await expect(page.getByRole('heading',{name:'ตรวจความพร้อมก่อนเผยแพร่',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'ตรวจสุขภาพแอพ',exact:true}).click();await expect(page.getByText('พร้อมเผยแพร่ตามรายการที่ตรวจ',{exact:true})).toBeVisible();
 database.prepare("UPDATE _columns SET default_expr='[missing]' WHERE table_name='publish_ready'").run();
 database.prepare("UPDATE _views SET sort_column='missing' WHERE name=?").run(list.name);
 database.exec("INSERT INTO _application_local_roles(app_id,name,label) VALUES('default','empty_role','Empty role');");
 const before=database.prepare('SELECT count(*) n FROM _audit_log').get().n;
 const report=await api('/api/readiness');assert.equal(report.status,'blocked');assert.equal(report.issues.filter(i=>i.kind==='formula').length,2);assert(report.issues.some(i=>i.kind==='permission'&&i.severity==='warning'));
 assert.equal(database.prepare('SELECT count(*) n FROM _audit_log').get().n,before);
 await page.getByRole('button',{name:'ตรวจสุขภาพแอพ',exact:true}).click();await expect(page.getByText('ต้องแก้ไขก่อนเผยแพร่',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^ข้อควรตรวจ \(/}).click();await expect(page.locator('.health-issue[data-severity="error"]')).toHaveCount(0);await expect(page.locator('.health-issue[data-severity="warning"]')).toHaveCount(1);
 await page.getByRole('button',{name:/^ต้องแก้ไข \(/}).click();await expect(page.locator('.health-issue[data-severity="error"]')).toHaveCount(3);
 await page.locator('.health-issue a[href="/views?view='+list.name+'"]').click();await expect(page).toHaveURL(base+'/views?view='+list.name);
 await expect(page.getByLabel('ชื่อ View',{exact:true})).toHaveValue(list.label);
 // The same check runs against a draft and the publish endpoint rejects real errors.
 const draft=await api('/api/releases','POST',{op:'create',label:'Blocked readiness draft'});
 const review=await api('/api/releases?id='+draft.id);assert(review.health.errors>0);
 await api('/api/releases','POST',{op:'publish',id:draft.id,review_hash:review.review_hash,confirmation:'เผยแพร่'},400);
 await page.goto(base+'/releases');await page.getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();
 await expect(page.getByRole('button',{name:'เผยแพร่การตั้งค่า',exact:true})).toBeDisabled();
 const fix=page.locator('.release-review .health-issue').filter({hasText:'ไม่พบคอลัมน์เรียงข้อมูล'}).getByRole('button',{name:'เปิดฉบับร่างไปแก้ไข'});await fix.click();await expect(page).toHaveURL(base+'/views?view='+list.name);
 assert((await page.context().cookies()).some(c=>c.name==='nocode_draft'&&c.value===draft.id));
 await api('/api/releases','POST',{op:'live'});await page.context().clearCookies({name:'nocode_draft'});
 database.prepare("UPDATE _columns SET default_expr=NULL WHERE table_name='publish_ready'").run();database.prepare("UPDATE _views SET sort_column='id' WHERE name=?").run(list.name);
 const warning=await api('/api/readiness');assert.equal(warning.errors,0);assert.equal(warning.status,'review');
 database.exec("DELETE FROM _application_local_roles WHERE app_id='default' AND name='empty_role'");
 assert.equal((await api('/api/readiness')).status,'ready');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/readiness');await page.getByRole('button',{name:'ตรวจสุขภาพแอพ',exact:true}).click();await expect(page.getByText('พร้อมเผยแพร่ตามรายการที่ตรวจ',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 console.log('Publish readiness passed: ready/review/blocked, read-only scans, formula/View/permission issues, filters, deep links, draft edit links, publish rejection and mobile.');
}finally{database.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
