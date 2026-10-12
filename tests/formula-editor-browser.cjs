
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('fs');const base=process.env.NOCODE_TEST_URL;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
async function main(){
 await api('/api/tables','POST',{name:'fe_choices',label:'Choices',columns:[{name:'name',label:'Name',type:'text',is_label:true}]});await api('/api/data/fe_choices','POST',{name:'First'});
 await api('/api/tables','POST',{name:'fe_orders',label:'Orders',columns:[{name:'name',label:'Name',type:'text'},{name:'amount',label:'Amount',type:'decimal'}]});
 let source=['IF(','  [amount] > 10,','  CONCATENATE("มาก",','    INDEX(SELECT(fe_choices[name], TRUE), 1)','  ),','  "น้อย"',')'].join('\n');
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 try{
 await page.goto(base+'/t/fe_orders/edit');await page.getByRole('button',{name:'แก้ไขคอลัมน์ Name',exact:true}).click();const column=page.getByRole('dialog',{name:'แก้ไขคอลัมน์ Name',exact:true});
 const direct=column.getByLabel('ค่าเริ่มต้น (Initial value)',{exact:true});
 // Labels are obtained from the existing shared formula field.
 const trigger=column.getByRole('button',{name:/เขียนสูตร.*เริ่มต้น/});await trigger.click();const assistant=page.getByRole('dialog',{name:'ตัวช่วยเขียนสูตร',exact:true}),input=assistant.locator('#assistant-source'),editor=input.locator('xpath=ancestor::div[contains(@class,"formula-code-editor")]');
 await input.fill(source);await expect(input).toHaveValue(source);await expect(editor.locator('.formula-code-paint')).toHaveText(source+'\n');
 for(const kind of ['function','table','column','string','number','keyword'])assert.ok(await editor.locator('.formula-token-'+kind).count()>0,kind);
 const metrics=await editor.evaluate(el=>{const t=el.querySelector('textarea'),p=el.querySelector('pre'),ts=getComputedStyle(t),ps=getComputedStyle(p);return{line:parseFloat(ts.lineHeight),paint:ps.lineHeight,font:ts.fontFamily,pfont:ps.fontFamily,height:el.clientHeight,textHeight:t.clientHeight};});assert.ok(metrics.line<21);assert.equal(metrics.paint,metrics.line+'px');assert.equal(metrics.font,metrics.pfont);assert.ok(metrics.height<150,'gutter must not expand editor to fit all lines');
 const colors=await editor.evaluate(el=>['function','table','column','string','number'].map(k=>getComputedStyle(el.querySelector('.formula-token-'+k)).color));assert.equal(new Set(colors).size,5);
 await input.fill('IF(TRUE, 1, 0)');await input.press('End');await input.press('Enter');await expect(input).toHaveValue('IF(TRUE, 1, 0)\n');await input.press('Control+z');await expect(input).toHaveValue('IF(TRUE, 1, 0)');
 await input.fill(source+'\n'.repeat(20));await input.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});assert.equal(await editor.locator('pre').evaluate(el=>el.scrollTop),await input.evaluate(el=>el.scrollTop));
 await input.fill('CONCATENATE("'+('ก'.repeat(180))+'", "x")');await input.evaluate(el=>{el.scrollLeft=el.scrollWidth;el.dispatchEvent(new Event('scroll'));});assert.equal(await editor.locator('pre').evaluate(el=>el.scrollLeft),await input.evaluate(el=>el.scrollLeft));
 await input.fill('SELECT(');await assistant.getByRole('button',{name:'จัดรูปแบบสูตร',exact:true}).click();await expect(input).toHaveValue('SELECT(');await expect(assistant.getByRole('alert')).toContainText('จัดรูปแบบสูตรไม่ได้');await expect(assistant.getByRole('button',{name:'ใช้สูตรนี้',exact:true})).toBeDisabled();await input.fill(source);await expect(assistant.getByRole('button',{name:'ใช้สูตรนี้',exact:true})).toBeEnabled();
 await input.fill('IF(  [amount]>10,CONCATENATE("มาก",INDEX(SELECT( fe_choices[name],TRUE),1)),"น้อย" )');await assistant.getByRole('button',{name:'จัดรูปแบบสูตร',exact:true}).click();source=await input.inputValue();assert.ok(source.startsWith('IF(\n  [amount] > 10,\n'));assert.ok(source.includes('fe_choices[name]'));assert.ok(source.includes('"มาก"'));await assistant.getByRole('button',{name:'จัดรูปแบบสูตร',exact:true}).click();await expect(input).toHaveValue(source);await expect(assistant.getByRole('alert')).toHaveCount(0);
 fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/formula-editor-desktop.png'});
 await assistant.getByRole('button',{name:'ใช้สูตรนี้',exact:true}).click();await expect(assistant).toHaveCount(0);const sourceInput=column.locator('textarea').filter({hasNot:page.locator('never')});assert.ok(await sourceInput.count()>0);await column.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(column).toHaveCount(0);
 const tables=await api('/api/tables');assert.equal(tables.find(t=>t.name==='fe_orders').columns.find(c=>c.name==='name').default_expr,source);
 await page.getByRole('button',{name:'แก้ไขคอลัมน์ Name',exact:true}).click();await page.getByRole('dialog',{name:'แก้ไขคอลัมน์ Name',exact:true}).getByRole('button',{name:/เขียนสูตร.*เริ่มต้น/}).click();await expect(input).toHaveValue(source);
 await page.setViewportSize({width:390,height:844});await expect(input).toBeVisible();assert.ok(await editor.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth));await page.screenshot({path:'artifacts/formula-editor-mobile.png'});
 await page.evaluate(()=>document.documentElement.dataset.mode='dark');const dark=await editor.locator('.formula-token-function').first().evaluate(el=>getComputedStyle(el).color);assert.notEqual(dark,colors[0]);await page.screenshot({path:'artifacts/formula-editor-dark.png'});assert.deepEqual(errors,[]);

 console.log('PASS: token colors, compact line spacing, multiline/undo, both scroll axes, incomplete syntax, unchanged saved formula, mobile width and dark mode');
 }finally{await browser.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
