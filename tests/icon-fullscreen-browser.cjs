const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/settings');
const picker=page.locator('.app-settings-form .icon-picker').first(),expand=picker.getByRole('button',{name:'ขยายตัวเลือกไอคอนเต็มจอ'}),dialog=page.getByRole('dialog',{name:'เลือกไอคอน',exact:true});
const savedIcon=(await (await fetch(base+'/api/settings')).json()).icon;
await expand.click();await expect(dialog).toBeVisible();await expect(dialog.locator('.icon-picker-grid button')).toHaveCount(384);
let box=await dialog.boundingBox();assert.ok(box.x<=1&&box.y<=1&&box.width>=1438&&box.height>=998,JSON.stringify(box));
await dialog.getByRole('button',{name:'แสดงไอคอนเพิ่มเติม'}).click();await expect(dialog.locator('.icon-picker-grid button')).toHaveCount(768);
await dialog.getByRole('searchbox',{name:'ค้นหาไอคอน',exact:true}).fill('รถยก');await dialog.getByRole('button',{name:'ไอคอน รถยก · tabler-forklift',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(picker.locator('.icon-picker-current')).toContainText('รถยก');
assert.equal((await (await fetch(base+'/api/settings')).json()).icon,savedIcon);
await expand.click();await dialog.getByRole('combobox',{name:'หมวดไอคอน',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(expand).toBeFocused();
await page.setViewportSize({width:390,height:844});await expand.click();box=await dialog.boundingBox();assert.ok(box.x<=1&&box.y<=1&&box.width>=388&&box.width<=391&&box.height>=842,JSON.stringify(box));
assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);await dialog.getByRole('searchbox',{name:'ค้นหาไอคอน',exact:true}).fill('');await expect(dialog.locator('.icon-picker-grid button')).toHaveCount(384);
require('node:fs').mkdirSync('artifacts/icon-fullscreen',{recursive:true});await page.screenshot({path:'artifacts/icon-fullscreen/mobile.png'});await dialog.getByRole('button',{name:'ปิดเลือกไอคอน',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(picker.locator('.icon-picker-grid button')).toHaveCount(96);assert.deepEqual(errors,[]);console.log('PASS fullscreen desktop/mobile, 384/768 icons, search, selection, Escape/focus return, close, inline regression and no browser errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});