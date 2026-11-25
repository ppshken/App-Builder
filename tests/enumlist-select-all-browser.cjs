const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
async function main(){const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
await api('/api/tables','POST',{name:'choices',label:'Choices',columns:[{name:'code',label:'Code',type:'text',is_key:true},{name:'name',label:'Name',type:'text',is_label:true},{name:'active',label:'Active',type:'yesno'}]});
for(const row of [{code:'a',name:'Alpha',active:1},{code:'b',name:'Beta',active:1},{code:'c',name:'Hidden',active:0}])await api('/api/data/choices','POST',row);
await api('/api/tables','POST',{name:'all_members',label:'Members',columns:[{name:'name',label:'Name',type:'text',is_label:true},{name:'permissions',label:'Permissions',type:'enumlist',valid_if:'SELECT(choices[code], [active] = TRUE)'},{name:'empty_choices',label:'Empty',type:'enumlist',valid_if:'SELECT(choices[code], FALSE)'},{name:'locked_choices',label:'Locked',type:'enumlist',options:'x,y',is_editable:false}]});
await page.goto(base+'/t/all_members');await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).click();
const form=page.locator('.data-form');
const open=label=>form.getByRole('group',{name:label,exact:true}).getByRole('button',{name:'เลือกค่า',exact:true}).click();
const done=dialog=>dialog.getByRole('button',{name:'เสร็จสิ้น',exact:true}).click();
await open('Permissions');
const choices=page.getByRole('dialog',{name:'Permissions',exact:true});
const select=choices.getByRole('button',{name:'เลือกทั้งหมด',exact:true});
const clear=choices.getByRole('button',{name:'ล้างทั้งหมด',exact:true});
const alpha=choices.getByRole('checkbox',{name:'Alpha',exact:true}),beta=choices.getByRole('checkbox',{name:'Beta',exact:true});
await expect(choices.getByRole('checkbox',{name:'Hidden',exact:true})).toHaveCount(0);
await select.click();await expect(alpha).toBeChecked();await expect(beta).toBeChecked();
await clear.click();await expect(alpha).not.toBeChecked();await expect(beta).not.toBeChecked();
await select.click();await done(choices);
await open('Empty');const empty=page.getByRole('dialog',{name:'Empty',exact:true});
await expect(empty.getByRole('button',{name:'เลือกทั้งหมด',exact:true})).toBeDisabled();await done(empty);
await expect(form.getByRole('group',{name:'Locked',exact:true}).getByRole('button',{name:'เลือกค่า',exact:true})).toBeDisabled();
await form.getByLabel('Name',{exact:true}).fill('Selected');
const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/data/all_members'));
await page.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();assert.ok((await saved).ok());const rows=await api('/api/data/all_members');assert.deepEqual(rows[0].permissions,['a','b']);assert.deepEqual(errors,[]);console.log('Select all passed: exact button labels, clear/reselect, saved business keys, mobile.');
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
