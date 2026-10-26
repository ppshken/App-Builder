const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:process.env.NOCODE_TEST_BROWSER||'msedge',headless:true});try{
 for(const config of [{width:390,touch:false},{width:390,touch:true},{width:844,touch:true},{width:1200,touch:true},{width:1600,touch:false}]){
 const context=await browser.newContext({viewport:{width:config.width,height:844},hasTouch:config.touch,isMobile:config.width<1024});const page=await context.newPage();
 await page.setContent('<div class="runtime-app"><input id="text"><input type="number"><input type="date"><input type="datetime-local"><input type="time"><textarea></textarea><select><option>A</option></select></div><dialog open class="editor-dialog"><input id="dialog-input"></dialog><div class="search-select-search"><input type="search"></div><div class="formula-code-editor"><pre class="formula-code-paint">COUNT()</pre><textarea class="formula-code-textarea">COUNT()</textarea></div>');
 await page.addStyleTag({content:fs.readFileSync('app/globals.css','utf8')});
 for(const scale of [0.8,1,1.5]){await page.evaluate(scale=>document.documentElement.style.setProperty('--font-scale',String(scale)),scale);
 const metrics=await page.locator('input,textarea,select,.formula-code-paint').evaluateAll(els=>els.map(el=>({id:el.id,cls:el.className,size:parseFloat(getComputedStyle(el).fontSize)})));
 if(config.touch||config.width<1024)for(const m of metrics)assert.ok(m.size>=16,JSON.stringify({config,scale,m}));
 else assert.ok(Math.abs(metrics[0].size-14*scale)<0.01,'Desktop typography stays unchanged');
 assert.equal(metrics.find(m=>m.cls==='formula-code-paint').size,metrics.find(m=>m.cls==='formula-code-textarea').size,'Formula overlay must align');
 }
 await context.close();
 }
 console.log('Mobile input sizing passed: portrait/landscape, touch and fine pointer, dialog/search/date/number, font scaling, formula alignment, desktop unchanged.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
