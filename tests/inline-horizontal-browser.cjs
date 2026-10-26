const {chromium,expect}=require('@playwright/test');
const base=process.env.NOCODE_TEST_URL;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();expect(r.ok,JSON.stringify(j)).toBe(true);return j;}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});try{
await api('/api/tables','POST',{name:'ih_parent',label:'Parent',columns:[{name:'name',label:'Name',type:'text'}]});
await api('/api/tables','POST',{name:'ih_child',label:'Children',columns:[{name:'name',label:'Name',type:'text',is_label:true},{name:'parent',label:'Parent',type:'ref',ref_table:'ih_parent',is_part_of:true}]});
const parent=await api('/api/data/ih_parent','POST',{name:'Parent One'});
for(let i=0;i<8;i++)await api('/api/data/ih_child','POST',{name:'Child '+i,parent:parent.id});
const views=await api('/api/views');const inline=views.find(v=>v.position==='inline'&&v.table_name==='ih_child'&&v.inline_ref==='parent');const detail=views.find(v=>v.kind==='detail'&&v.table_name==='ih_parent');
const update=flag=>api('/api/views','PUT',{...inline,kind:'list',display:{inline_list_horizontal:flag,title_column:'name',list_buttons:'none'}});
await update(true);
await page.goto(base+'/run?view='+detail.name+'&row='+parent.id);
const lane=page.locator('.inline-record-horizontal');await expect(lane).toHaveCount(1);await expect(lane.locator('li')).toHaveCount(5);
expect(await lane.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
await lane.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>lane.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
await page.screenshot({path:'artifacts/inline-horizontal-mobile.png'});
await page.setViewportSize({width:1440,height:900});expect(await lane.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
await page.screenshot({path:'artifacts/inline-horizontal-desktop.png'});
await page.goto(base+'/run?view='+inline.name);await expect(page.locator('.record-card').first()).toBeVisible();await expect(page.locator('.inline-record-horizontal')).toHaveCount(0);
const form=views.find(v=>v.kind==='form'&&v.table_name==='ih_parent');await page.goto(base+'/run?view='+form.name+'&row='+parent.id);await expect(page.locator('#data-name')).toBeVisible();await expect(page.locator('.part-of-records .inline-record-horizontal')).toHaveCount(1);await expect(page.locator('.part-of-records .inline-record-horizontal li')).toHaveCount(8);await page.setViewportSize({width:390,height:844});expect(await page.locator('.part-of-records .inline-record-horizontal').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);await page.screenshot({path:'artifacts/inline-horizontal-form.png'});
await update(false);await page.goto(base+'/run?view='+detail.name+'&row='+parent.id);await expect(page.locator('.inline-record-title').first()).toBeVisible();await expect(page.locator('.inline-record-horizontal')).toHaveCount(0);
console.log('Horizontal Inline passed: detail and form scrolling, mobile/desktop, standalone unchanged, opt-out.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
