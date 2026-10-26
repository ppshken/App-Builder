const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('isolated database required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});expect(r.ok).toBe(true);return r.json();}
(async()=>{
 const original=await api('/api/settings'),other=await api('/api/applications','POST',{label:'ระบบงานแยก',description:'ทดสอบเมนูเฉพาะแอป'});
 const login=await api('/api/auth/login','POST',{email:'a@example.com',password:'TestPassword123'});expect(login.redirectTo).toBe('/apps');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const card=name=>page.locator('.application-card').filter({has:page.getByRole('heading',{name,exact:true})});
 await page.goto(base+'/');await page.waitForURL('**/apps');
 await expect(page.locator('.builder-global-nav')).toHaveCount(0);await expect(page.locator('.data-navigator')).toHaveCount(0);await expect(page.locator('.builder-open-app')).toHaveCount(0);
 await expect(card(original.name)).toBeVisible();await expect(card(other.label)).toBeVisible();
 await card(other.label).getByRole('button',{name:'ตั้งค่า',exact:true}).click();await page.waitForURL('**/settings');await expect(page.locator('.builder-brand')).toHaveText(other.label);await expect(page.locator('.builder-global-nav')).toBeVisible();
 const appName=page.getByRole('textbox',{name:'ชื่อแอพ',exact:true});await expect(appName).toHaveValue(other.label);
 await page.locator('.builder-global-nav a[href="/data"]').click();await expect(page.getByRole('heading',{name:'ตารางของฉัน',exact:true})).toBeVisible();await expect(page.locator('.data-navigator .data-table-group')).toHaveCount(0);
 await page.locator('.builder-global-nav a[href="/app-access"]').click();await page.getByRole('button',{name:'จัดการตารางและสิทธิ์',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(other.label);await page.getByRole('button',{name:'เสร็จสิ้น',exact:true}).click();
 await page.locator('.builder-back-apps').click();await page.waitForURL('**/apps');await expect(page.locator('.builder-global-nav')).toHaveCount(0);
 await card(original.name).getByRole('button',{name:'ตั้งค่า',exact:true}).click();await page.waitForURL('**/settings');await expect(page.locator('.builder-brand')).toHaveText(original.name);await expect(appName).toHaveValue(original.name);
 await page.goto(base+'/?new=1');await page.waitForURL(url=>url.pathname==='/data');await expect(page.getByRole('dialog',{name:'สร้างตารางใหม่',exact:true})).toBeVisible();await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.locator('.builder-back-apps').click();await page.waitForURL('**/apps');await expect(card(other.label)).toBeVisible();fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/application-launcher-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.builder-global-nav')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/application-launcher-mobile.png',fullPage:true});
 await card(other.label).getByRole('button',{name:'ตั้งค่า',exact:true}).click();await page.waitForURL('**/settings');await expect(page.locator('.builder-brand')).toHaveText(other.label);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(appName).toHaveValue(other.label);await page.screenshot({path:'artifacts/application-manager-mobile.png'});
 await page.locator('.builder-back-apps').click();await page.waitForURL('**/apps');await card(other.label).getByRole('button',{name:'เปิดแอป',exact:true}).click();await page.waitForURL(url=>url.pathname==='/run');expect(new URL(page.url()).searchParams.get('app')).toBe(other.id);await expect(page.locator('.builder-global-nav')).toHaveCount(0);
 expect(errors).toEqual([]);await context.close();console.log('Launcher passed: root/sign-in, hidden management, scoped settings/data/access, return, old links, desktop/mobile and runtime entry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
