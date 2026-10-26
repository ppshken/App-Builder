const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL,ownerCookie=process.env.NOCODE_TEST_COOKIE;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('isolated database required');
async function request(path,method='GET',body,cookie=ownerCookie){return fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
async function api(path,method='GET',body,cookie=ownerCookie){const r=await request(path,method,body,cookie);expect(r.ok,await r.clone().text()).toBe(true);return r.json();}
(async()=>{
 await api('/api/tables','POST',{name:'secure_cars',label:'Cars',columns:[{name:'name',label:'Name',type:'text'}]});
 await api('/api/data/secure_cars','POST',{name:'Car A'});
 const other=await api('/api/applications','POST',{label:'Repairs',description:''});
 const legacy=await api('/api/users','POST',{op:'create_role',label:'Legacy Viewer',builder:false,tables:{secure_cars:{read:true,create:false,update:false,delete:false,export:true}},actions:[],row_rules:{}});
 await api('/api/users','POST',{op:'create_user',name:'Legacy User',email:'legacy@example.com',password:'Password12345',role:legacy.name,active:true});
 const before=await api('/api/users');const legacyUser=before.users.find(u=>u.email==='legacy@example.com');
 const login=await request('/api/auth/login','POST',{email:'legacy@example.com',password:'Password12345'},'');expect(login.status).toBe(200);const staffCookie=login.headers.get('set-cookie').split(';')[0];
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/apps?tab=central&section=users&userTab=roles');
 await expect(page.getByRole('tab',{name:'สิทธิ์จัดการ Builder'})).toHaveAttribute('aria-selected','true');
 await expect(page.getByText('สิทธิ์ข้อมูลแต่ละตาราง',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'ย้ายสิทธิ์เดิมและแยกการจัดการ',exact:true}).click();
 const migration=page.waitForResponse(r=>r.url().endsWith('/api/users')&&r.request().postDataJSON()?.op==='separate_builder_security');
 await page.getByRole('button',{name:'ยืนยันย้ายสิทธิ์',exact:true}).click();expect((await migration).ok()).toBe(true);
 await expect(page.getByLabel('แอปที่ต้องการจัดการ')).toBeVisible();
 const after=await api('/api/users');expect(after.builder_security.separated).toBe(true);expect(after.users).toEqual(before.users);expect(after.roles.find(r=>r.name===legacy.name)).not.toHaveProperty('tables');
 // Existing runtime permissions and session survive; new app is denied.
 expect((await request('/api/data/secure_cars','GET',undefined,staffCookie)).status).toBe(200);
 expect((await request('/api/excel/secure_cars','GET',undefined,staffCookie)).status).toBe(200);
 expect((await request('/api/views','POST',{},staffCookie)).status).toBe(403);
 expect((await request('/api/users','POST',{op:'set_application_builder',app_id:other.id,user_id:legacyUser.id,can_manage:true},staffCookie)).status).toBe(403);
 expect((await request('/api/applications','POST',{op:'select',id:other.id},staffCookie)).status).toBe(403);
 await page.getByLabel('พัฒนาแอป Legacy User',{exact:true}).check();
 await expect(page.getByLabel('พัฒนาแอป Legacy User',{exact:true})).toBeChecked();
 await expect.poll(async()=>(await api('/api/applications','GET',undefined,staffCookie)).find(a=>a.id==='default')?.can_manage).toBe(true);

 // Developers can use every app tool, while platform administration remains denied.
 for(const endpoint of ['/api/workflows','/api/pdf-templates','/api/releases'])expect((await request(endpoint,'GET',undefined,staffCookie)).status).toBe(200);
 for(const endpoint of ['/api/users','/api/backups','/api/audit-log','/api/applications?overview=1'])expect((await request(endpoint,'GET',undefined,staffCookie)).status).toBe(403);
 await api('/api/user-settings','POST',{op:'create',name:'developer_note',label:'Developer note',type:'text',options:[],default_value:''},staffCookie);
 await api('/api/pdf-templates','POST',{name:'dev_report',label:'Developer report',table_name:'secure_cars',title_expr:'[name]',columns:['name'],orientation:'portrait',related:[]},staffCookie);
 await api('/api/actions','POST',{name:'dev_stamp',label:'Developer stamp',table_name:'secure_cars',kind:'set',condition_expr:'TRUE',values:{name:'"Scheduled by developer"'},confirmation:''},staffCookie);
 await api('/api/workflows','POST',{name:'dev_schedule',label:'Developer schedule',table_name:'secure_cars',enabled:true,execution:'background',event:'schedule',condition_expr:'TRUE',watch_columns:[],interval_minutes:60,steps:[{kind:'action',action_name:'dev_stamp'}]},staffCookie);
 const Database=require('better-sqlite3'),testDb=new Database(process.env.NOCODE_TEST_DB);testDb.function('nocode_audit_enabled',()=>0);testDb.function('nocode_audit_entries',(_table,_operation,_before,_after)=> '[]');testDb.prepare('UPDATE _automations SET next_run_at=? WHERE name=?').run(Date.now()-1000,'dev_schedule');testDb.close();
 await expect.poll(async()=>(await api('/api/data/secure_cars','GET',undefined,staffCookie))[0].name,{timeout:20000}).toBe('Scheduled by developer');
 const draft=await api('/api/releases','POST',{op:'create',label:'Developer draft'},staffCookie);
 await api('/api/releases','POST',{op:'activate',id:draft.id},staffCookie);const draftCookie=staffCookie+'; nocode_draft='+draft.id;
 const liveSettings=await api('/api/settings','GET',undefined,staffCookie);await api('/api/settings','PUT',{...liveSettings,color:'teal'},draftCookie);
 expect((await api('/api/settings','GET',undefined,draftCookie)).color).toBe('teal');expect((await api('/api/settings','GET',undefined,staffCookie)).color).toBe(liveSettings.color);
 expect((await request('/api/releases?id='+draft.id,'GET',undefined,ownerCookie)).status).toBe(403);
 const devContext=await browser.newContext({storageState:{cookies:[],origins:[]}});await devContext.addCookies([{name:'nocode_draft',value:draft.id,url:base,httpOnly:true,sameSite:'Strict'},{name:'nocode_session',value:staffCookie.split('=')[1],url:base,httpOnly:true,sameSite:'Lax'}]);const devPage=await devContext.newPage();
 await devPage.goto(base+'/settings');const devNav=devPage.getByRole('navigation',{name:'เมนูหลัก',exact:true});for(const label of ['Automation','เวอร์ชันแอพ','ตารางและสิทธิ์'])await expect(devNav.getByRole('link',{name:label,exact:true})).toBeVisible();
 await devNav.getByRole('link',{name:'Automation',exact:true}).click();await devPage.waitForURL(url=>url.pathname==='/workflows');await expect(devPage.getByText('Developer schedule',{exact:true}).first()).toBeVisible();
 await devPage.goto(base+'/app-access?tab=user-settings');await expect(devPage.getByRole('button',{name:'เพิ่มค่าตั้งค่า',exact:true})).toBeVisible();await expect(devPage.getByRole('button',{name:'จัดการตารางและสิทธิ์',exact:true})).toHaveCount(0);await expect(devPage.getByText('ผู้ใช้และบทบาทของแอปนี้',{exact:true})).toHaveCount(0);await devContext.close();
 await page.getByLabel('พัฒนาแอป Legacy User',{exact:true}).uncheck();
 await expect.poll(async()=>(await api('/api/applications','GET',undefined,staffCookie)).find(a=>a.id==='default')?.can_manage).toBe(false);
 for(const endpoint of ['/api/workflows','/api/pdf-templates','/api/releases'])expect((await request(endpoint,'GET',undefined,draftCookie)).status).toBe(403);
 await expect(page.getByText('สิทธิ์ข้อมูลแต่ละตาราง',{exact:true})).toHaveCount(0);
 fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/builder-security-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/builder-security-mobile.png',fullPage:true});
 // Existing role is now edited only in the target app, without legacy fallback.
 await page.goto(base+'/apps?tab=central&section=members&app=default');await page.getByRole('tab',{name:'บทบาทของแอป',exact:true}).click();await expect(page.getByRole('heading',{name:'Legacy Viewer',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'สมาชิกแอป',exact:true}).click();await page.getByLabel('บทบาทในแอปของ Legacy User',{exact:true}).click();await expect(page.getByRole('option',{name:'ใช้สิทธิ์ส่วนกลางเดิม',exact:true})).toHaveCount(0);
 expect((await request('/api/users','POST',{op:'update_role',name:legacy.name,label:'Changed',builder:true,tables:{},actions:[]})).status).toBe(409);
 expect(errors).toEqual([]);console.log('Builder security passed: UI migration, unchanged session/account/data rights, per-app developer grant/revoke, owner protection, no legacy runtime editor, desktop/mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
