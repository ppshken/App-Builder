
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');const {selectChoice,assertControlValue}=require('./dropdown-helpers.cjs');
const base=process.env.NOCODE_TEST_URL;if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
async function main(){
 await api('/api/tables','POST',{name:'pc_parent',label:'Inspections',columns:[{name:'name',label:'Name',type:'text',required:true}]});
 await api('/api/tables','POST',{name:'pc_category',label:'Categories',columns:[{name:'name',label:'Name',type:'text',is_label:true}]});
 for(const name of ['Front','Back','Side'])await api('/api/data/pc_category','POST',{name});
 const formula='SELECT(pc_category[id], NOT(IN([id], SELECT(pc_child[category], AND([parent] = [_THISROW].[parent], [id] <> [_THISROW].[id])))))';
 await api('/api/tables','POST',{name:'pc_child',label:'Photos',columns:[{name:'name',label:'Name',type:'text',required:true,is_label:true},{name:'parent',label:'Parent',type:'ref',ref_table:'pc_parent',required:true,is_part_of:true},{name:'category',label:'Category',type:'ref',ref_table:'pc_category',required:true,valid_if:formula,default_expr:'INDEX('+formula+', 1)'}]});
 const views=await api('/api/views'),parentForm=views.find(v=>v.table_name==='pc_parent'&&v.kind==='form');
 const group=records=>[{table:'pc_child',column:'parent',records}],record=(key,category)=>({key,values:{name:key,category}});
 await api('/api/data/pc_parent','POST',{name:'duplicate batch',__children:group([record('one',1),record('two',1)])},400);
 assert.equal((await api('/api/data/pc_parent')).length,0);assert.equal((await api('/api/data/pc_child')).length,0);
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+'/run?view='+parentForm.name);await page.locator('#data-name').fill('New inspection');
 const dialog=()=>page.getByRole('dialog',{name:'Photos · รายการลูก',exact:true});
 const open=async()=>{await page.getByRole('button',{name:'เพิ่มรายการลูก',exact:true}).click();await expect(dialog()).toBeVisible();};
 const allowed=async()=>{await dialog().locator('#data-part-pc_child-category').click();const popup=page.locator('.search-select-dialog');await expect(popup).toBeVisible();return popup.locator('select').evaluate(el=>Array.from(el.options).filter(o=>o.value&&!o.disabled).map(o=>o.value));};
 const closeChoices=async()=>{await page.locator('.search-select-dialog').press('Escape');};
 await open();await assertControlValue(dialog().locator('#data-part-pc_child-category'),'1');await selectChoice(dialog().locator('#data-part-pc_child-category'),'1');await dialog().locator('#data-part-pc_child-name').fill('Front photo');await dialog().getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(dialog()).toHaveCount(0);
 assert.equal((await api('/api/data/pc_child')).length,0);
 await open();await assertControlValue(dialog().locator('#data-part-pc_child-category'),'2');assert.deepEqual(await allowed(),['2','3']);require('fs').mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/pending-child-filter.png'});await closeChoices();await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.getByRole('button',{name:'แก้ไขรายการลูก Front photo',exact:true}).click();assert.deepEqual(await allowed(),['1','2','3']);await closeChoices();await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.getByRole('button',{name:'นำรายการลูกออก Front photo',exact:true}).click();await open();assert.deepEqual(await allowed(),['1','2','3']);await closeChoices();await selectChoice(dialog().locator('#data-part-pc_child-category'),'1');await dialog().locator('#data-part-pc_child-name').fill('Front photo');await dialog().getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();
 await open();await selectChoice(dialog().locator('#data-part-pc_child-category'),'2');await dialog().locator('#data-part-pc_child-name').fill('Back photo');await dialog().getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();
 await page.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(page.locator('#data-name')).toHaveCount(0);
 const parents=await api('/api/data/pc_parent'),children=await api('/api/data/pc_child');assert.equal(parents.length,1);assert.equal(children.length,2);assert.ok(children.every(c=>c.parent===parents[0].id&&c.id>0));
 await page.goto(base+'/run?view='+parentForm.name+'&row='+parents[0].id);await open();await assertControlValue(dialog().locator('#data-part-pc_child-category'),'3');assert.deepEqual(await allowed(),['3']);await closeChoices();await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.getByRole('button',{name:'นำรายการลูกออก Front photo',exact:true}).click();await open();assert.deepEqual(await allowed(),['1','3']);await closeChoices();await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.goto(base+'/run?view='+parentForm.name);await open();assert.deepEqual(await allowed(),['1','2','3']);await closeChoices();await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.equal((await api('/api/data/pc_child')).length,2);assert.deepEqual(errors,[]);
 
 await api('/api/data/pc_parent','POST',{name:'Other inspection'});
 await page.goto(base+'/t/pc_child');await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).click();const standalone=page.getByRole('dialog',{name:'เพิ่มข้อมูล',exact:true});
 await assertControlValue(standalone.locator('#data-category'),'1');
 await selectChoice(standalone.locator('#data-parent'),'1');await assertControlValue(standalone.locator('#data-category'),'');
 await standalone.locator('#data-category').click();const popup=page.locator('.search-select-dialog');assert.deepEqual(await popup.locator('select').evaluate(el=>Array.from(el.options).filter(o=>o.value&&!o.disabled).map(o=>o.value)),['3']);await popup.press('Escape');
 await selectChoice(standalone.locator('#data-parent'),'2');await selectChoice(standalone.locator('#data-category'),'1');await assertControlValue(standalone.locator('#data-category'),'1');
 await selectChoice(standalone.locator('#data-parent'),'1');await assertControlValue(standalone.locator('#data-category'),'');await standalone.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 console.log('PASS: unsaved parent sibling filtering, own edit, delete/re-add, real parent filtering, cancellation isolation, positive real IDs, and duplicate batch transaction rollback');
 }finally{await browser.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
