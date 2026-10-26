const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await page.goto(base+'/run');
 let requests=0,fail=false;await page.route('**/api/data/cache_probe*',route=>{requests++;return route.fulfill({status:fail?403:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Forbidden'}:[{id:1,name:'server '+requests}])});});
 const sources={storage:compile('lib/runtime-storage.ts'),cache:compile('lib/runtime-cache.ts')};
 const inject=()=>page.evaluate(sources=>{const storage={exports:{}};new Function('module','exports',sources.storage)(storage,storage.exports);const load=()=>{const cache={exports:{}};new Function('module','exports','require',sources.cache)(cache,cache.exports,()=>storage.exports);return cache.exports;};window.cacheHarness={storage:storage.exports,load,cache:load()};},sources);
 await inject();
 const read=scope=>page.evaluate(async scope=>{const c=window.cacheHarness.cache;c.configureRuntimeStorage(scope);return c.runtimeJSON('/api/data/cache_probe','preview@example.com',15000);},scope);
 assert.equal((await read('owner-live'))[0].name,'server 1');
 await expect.poll(()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nocode-runtime-cache-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return new Promise(resolve=>{const r=db.transaction('reads').objectStore('reads').count();r.onsuccess=()=>{resolve(r.result);db.close();};});})).toBeGreaterThan(0);
 await page.evaluate(()=>window.cacheHarness.cache=window.cacheHarness.load());assert.equal((await read('owner-live'))[0].name,'server 1');assert.equal(requests,1,'A new memory cache must reuse IndexedDB');
 assert.equal((await read('other-user'))[0].name,'server 2');assert.equal((await read('owner-draft'))[0].name,'server 3');
 await page.evaluate(()=>window.cacheHarness.cache.clearRuntimeCache());assert.equal((await read('owner-live'))[0].name,'server 4');
 // Expired entries must read the server, never silently fall back after permission denial.
 await page.evaluate(async()=>{const h=window.cacheHarness;await h.storage.clearStoredRuntime();await h.storage.storeRuntime('owner-live',JSON.stringify(['/api/data/cache_probe','preview@example.com']),[{id:1,name:'expired secret'}],Date.now()-100);h.cache=h.load();});fail=true;
 assert.match(await page.evaluate(async()=>{try{const c=window.cacheHarness.cache;c.configureRuntimeStorage('owner-live');await c.runtimeJSON('/api/data/cache_probe','preview@example.com',15000);return 'unexpected';}catch(e){return e.message;}}),/Forbidden/);fail=false;
 await page.evaluate(async()=>{const h=window.cacheHarness;for(let i=0;i<105;i++)await h.storage.storeRuntime('bounded',String(i),{id:i},Date.now()+15000);});
 assert.equal(await page.evaluate(async()=>{const r=indexedDB.open('nocode-runtime-cache-v1');const db=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));return new Promise(resolve=>{const n=db.transaction('reads').objectStore('reads').count();n.onsuccess=()=>{resolve(n.result);db.close();};});}),100);
 await page.getByRole('button',{name:'เปิดเมนูแอป',exact:true}).click();await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await expect(page).toHaveURL(/\/login/);
 assert.equal(await page.evaluate(async()=>{const r=indexedDB.open('nocode-runtime-cache-v1');const db=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));return new Promise(resolve=>{const n=db.transaction('reads').objectStore('reads').count();n.onsuccess=()=>{resolve(n.result);db.close();};});}),0,'Logout must finish clearing stored reads before navigation');
 await inject();
 await page.evaluate(()=>{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});window.cacheHarness.cache=window.cacheHarness.load();});assert.equal((await read('no-storage'))[0].name,'server 6');
 console.log('Persistent cache passed: reused disk reads, user/workspace isolation, invalidation, expiry and 403 safety, 100-entry bound, unavailable IndexedDB fallback. Chromium mobile emulation; physical iPhone pending.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
