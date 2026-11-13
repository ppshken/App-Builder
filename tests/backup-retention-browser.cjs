const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.NOCODE_TEST_URL,cookie=process.env.NOCODE_TEST_COOKIE,db=process.env.NOCODE_TEST_DB;
if(!db?.includes('integration-'))throw Error('Isolated runner required');
const folder=path.join(path.dirname(db),'backups');fs.mkdirSync(folder,{recursive:true});
const add=(kind,age)=>{const name='data.backup-'+kind+'-2026-01-01T00-00-00-000Z-'+crypto.randomUUID()+'.db',file=path.join(folder,name);fs.writeFileSync(file,Buffer.alloc(1024));const at=new Date(Date.now()-age*86400000);fs.utimesSync(file,at,at);return name;};
const kept=[add('schema',1),add('schema',2),add('schema',3),add('restore',30),add('manual',40)],old=add('schema',20);
async function api(method='GET',body,extra={}){const r=await fetch(base+'/api/backups/retention',{method,headers:{cookie,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
(async()=>{
 assert.equal((await fetch(base+'/api/backups/retention',{headers:{cookie:''}})).status,401);
 assert.equal((await api('PUT',{enabled:false,days:7,keepLatest:3,maxAutomaticFiles:0,maxAutomaticMB:0},{Origin:'https://untrusted.example.test'})).status,403);
 const initial=await api();assert.equal(initial.status,200);assert.equal(initial.body.policy.enabled,false);assert.equal(initial.body.candidateCount,1);
 const p=await api('POST',{op:'preview'});assert.equal(p.status,200);assert.deepEqual(p.body.candidates.map(f=>f.name),[old]);
 assert.equal((await api('POST',{op:'cleanup',token:p.body.token,confirmation:''})).status,400);assert.ok(fs.existsSync(path.join(folder,old)));
 add('manual',50);assert.equal((await api('POST',{op:'cleanup',token:p.body.token,confirmation:'ล้างไฟล์สำรอง'})).status,409);assert.ok(fs.existsSync(path.join(folder,old)));
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/apps?tab=central&section=backups');
  const region=page.getByRole('region',{name:'การเก็บไฟล์สำรอง',exact:true});await expect(region).toBeVisible();await expect(region.getByLabel('เก็บย้อนหลัง (วัน)',{exact:true})).toHaveValue('7');
  await region.getByRole('button',{name:'ตรวจรายการที่จะล้าง',exact:true}).click();let dialog=page.getByRole('dialog',{name:'ยืนยันล้างไฟล์สำรองอัตโนมัติ',exact:true});await expect(dialog).toContainText('1 ไฟล์');await expect(dialog.getByRole('button',{name:'ยืนยันล้างไฟล์สำรอง',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.ok(fs.existsSync(path.join(folder,old)));
  await region.getByRole('button',{name:'ตรวจรายการที่จะล้าง',exact:true}).click();dialog=page.getByRole('dialog',{name:'ยืนยันล้างไฟล์สำรองอัตโนมัติ',exact:true});await dialog.getByLabel('พิมพ์ ล้างไฟล์สำรอง เพื่อยืนยัน',{exact:true}).fill('ล้างไฟล์สำรอง');await dialog.getByRole('button',{name:'ยืนยันล้างไฟล์สำรอง',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(region.getByRole('status')).toContainText('ล้างแล้ว 1 ไฟล์');
  assert.ok(!fs.existsSync(path.join(folder,old)));for(const name of kept)assert.ok(fs.existsSync(path.join(folder,name)));
  await region.getByLabel('เก็บย้อนหลัง (วัน)',{exact:true}).fill('14');await region.getByRole('button',{name:'บันทึกนโยบาย',exact:true}).click();await expect(region.getByRole('status')).toContainText('บันทึกนโยบายแล้ว');await page.reload();await expect(page.getByRole('region',{name:'การเก็บไฟล์สำรอง',exact:true}).getByLabel('เก็บย้อนหลัง (วัน)',{exact:true})).toHaveValue('14');
  await page.screenshot({path:'.test-data/backup-retention-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.test-data/backup-retention-mobile.png',fullPage:true});
 }finally{await browser.close();}
 const role=await fetch(base+'/api/users',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({op:'create_role',label:'Retention Viewer',builder:false,tables:{},actions:[]})});assert.equal(role.status,200);const roleName=(await role.json()).name;
 const user=await fetch(base+'/api/users',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({op:'create_user',name:'Retention User',email:'retention@example.test',password:'TestPassword123',role:roleName,active:true})});assert.equal(user.status,200);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'retention@example.test',password:'TestPassword123'})});assert.equal(login.status,200);const userCookie=login.headers.get('set-cookie').split(';')[0];
 for(const [method,body]of [['GET'],['POST',{op:'preview'}],['PUT',initial.body.policy]])assert.equal((await api(method,body,{cookie:userCookie})).status,403);
 console.log('PASS retention API authentication, CSRF, owner permissions, preview, stale inventory, cancel, typed confirmation, protected files, settings persistence, desktop/mobile rendering');
})().catch(e=>{console.error(e);process.exitCode=1;});
