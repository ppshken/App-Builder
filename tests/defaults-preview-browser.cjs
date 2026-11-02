const {chromium,expect}=require('@playwright/test');
const {selectChoice}=require('./dropdown-helpers.cjs');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/settings');
 await page.getByText('ตัวเลือกขั้นสูง · ค่าตั้งต้นหน้าจอทั้งหมด',{exact:true}).click();
 const defaults=page.getByRole('region',{name:'ค่าตั้งต้นรูปแบบหน้าจอ',exact:true});
 await selectChoice(defaults.getByLabel('รูปแบบรายละเอียด',{exact:true}),'edges');
 const field=defaults.locator('.defaults-preview .configured-detail > div').first();
 await expect(field).toHaveCSS('display','grid');await expect(field.locator('dd')).toHaveCSS('text-align','right');
 await defaults.getByLabel('ระยะห่างช่องรายละเอียด',{exact:true}).fill('30');await expect(field).toHaveCSS('padding-top','30px');await expect(field).toHaveCSS('padding-bottom','30px');
 const lineBefore=await field.locator('dd').evaluate(e=>parseFloat(getComputedStyle(e).lineHeight));
 await defaults.getByLabel('ระยะห่างบรรทัดรายละเอียด',{exact:true}).fill('2.8');
 await expect.poll(()=>field.locator('dd').evaluate(e=>parseFloat(getComputedStyle(e).lineHeight))).toBeGreaterThan(lineBefore);
 const narrow=await defaults.locator('.defaults-preview-screen').evaluate(e=>e.getBoundingClientRect().width);
 await defaults.getByRole('button',{name:'จอกว้าง',exact:true}).click();const dialog=page.getByRole('dialog',{name:'ตัวอย่างหน้าจอแบบจอกว้าง',exact:true});await expect(dialog).toBeVisible();
 expect(await dialog.locator('.defaults-preview-screen').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(narrow+200);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await defaults.getByRole('tab',{name:'กราฟ',exact:true}).click();
 const chart=defaults.locator('.defaults-preview .chart-view svg');
 for(const type of ['horizontal','area','donut','bar','line','pie']){
  await selectChoice(defaults.getByLabel('รูปแบบกราฟ',{exact:true}),type);
  await expect(chart).toBeVisible();
  if(type==='horizontal'){const rect=chart.locator('rect').first();expect(Number(await rect.getAttribute('width'))).toBeGreaterThan(Number(await rect.getAttribute('height')));}
  if(type==='area')await expect(chart.locator('polygon')).toHaveCount(1);
  if(type==='donut'){await expect(chart.locator('circle')).toHaveCount(3);expect(Number(await chart.locator('circle').first().getAttribute('r'))).toBeGreaterThan(Number(await chart.locator('circle').first().getAttribute('stroke-width'))/2);}
  if(type==='line')await expect(chart.locator('polyline')).toHaveCount(1);
  if(type==='bar')await expect(chart.locator('rect')).toHaveCount(3);
 }
 await page.setViewportSize({width:390,height:844});await defaults.locator('.defaults-preview').scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await defaults.getByRole('button',{name:'จอกว้าง',exact:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 expect(errors).toEqual([]);console.log('Defaults Preview passed: edge layout, field spacing, line height, wide dialog/Escape, six chart types, mobile overflow.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
