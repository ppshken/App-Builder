const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert(r.ok,JSON.stringify(j));return j;}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 await api('/api/tables','POST',{name:'disabled_source',label:'Disabled source',columns:[{name:'name',label:'Name',type:'text'}]});await api('/api/data/disabled_source','POST',{name:'Keep original data'});
 const app=await api('/api/applications','POST',{label:'Readiness scope app'}),rights={read:true,create:false,update:false,delete:false,export:false},cookie=process.env.NOCODE_TEST_COOKIE+'; nocode_app='+app.id;
 await api('/api/applications','PUT',{op:'dataset',id:app.id,table:'disabled_source',rights});assert.equal((await api('/api/views','GET',undefined,cookie)).length,3);
 await api('/api/applications','PUT',{op:'dataset',id:app.id,table:'disabled_source',rights:{...rights,read:false}});assert.equal((await api('/api/views','GET',undefined,cookie)).length,0);
 const report=await api('/api/readiness','GET',undefined,cookie);assert.equal(report.errors,0);assert.equal(report.excluded.View,3);
 const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addCookies([{name:'nocode_app',value:app.id,url:base,httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage();await page.goto(base+'/readiness');await page.getByRole('button',{name:'ตรวจสุขภาพแอพ',exact:true}).click();
 await expect(page.getByText(/ข้ามรายการของตารางที่ไม่ได้เปิดใช้งานในแอป: View 3 รายการ/)).toBeVisible();await expect(page.getByText('ต้องแก้ไขก่อนเผยแพร่',{exact:true})).toHaveCount(0);
 assert.equal((await api('/api/data/disabled_source'))[0].name,'Keep original data');
 console.log('Readiness scope passed: disabled shared dataset Views stay hidden, are excluded from checks, UI explains the count, and original data remains.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
