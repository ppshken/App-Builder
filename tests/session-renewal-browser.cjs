const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),{createHash}=require('node:crypto');const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),database=new Database(process.env.NOCODE_TEST_DB);try{
 const token=process.env.NOCODE_TEST_COOKIE.split('=')[1],hash=createHash('sha256').update(token).digest('hex'),day=24*60*60*1000;
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();let pulses=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/auth/session')pulses++;});await page.clock.install({time:Date.now()});
 await page.goto(base+'/apps');await expect(page.getByRole('heading',{name:'แอปของฉัน',exact:true})).toBeVisible();await expect.poll(()=>pulses).toBeGreaterThan(0);
 const renewedCookie=(await context.cookies()).find(c=>c.name==='nocode_session');assert(renewedCookie.httpOnly);assert.equal(renewedCookie.sameSite,'Lax');assert(renewedCookie.expires*1000>Date.now()+29*day);
 // Renew a still-valid legacy lease through an ordinary authenticated API call.
 database.prepare('UPDATE _sessions SET last_seen=?,expires_at=? WHERE token_hash=?').run(Date.now(),Date.now()+12*60*60*1000,hash);
 const response=await fetch(base+'/api/tables');assert(response.ok);assert.match(response.headers.get('set-cookie'),/Max-Age=2592000/);assert(database.prepare('SELECT expires_at FROM _sessions WHERE token_hash=?').get(hash).expires_at>Date.now()+29*day);
 const created=await fetch(base+'/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:'Session persistence app'})});assert.equal(created.status,201);const app=await created.json();
 const selected=await fetch(base+'/api/applications',{method:'POST',headers:{'Content-Type':'application/json',cookie:process.env.NOCODE_TEST_COOKIE+'; nocode_app=default'},body:JSON.stringify({op:'select',id:app.id})});assert(selected.ok);const appCookies=selected.headers.getSetCookie().filter(c=>c.startsWith('nocode_app='));assert.equal(appCookies.length,1);assert(appCookies[0].startsWith('nocode_app='+app.id+';'));assert.match(appCookies[0],/Max-Age=2592000/);
 const remembered=await fetch(base+'/api/auth/session',{headers:{cookie:process.env.NOCODE_TEST_COOKIE+'; nocode_app='+app.id}});assert.match(remembered.headers.getSetCookie().find(c=>c.startsWith('nocode_app=')),/Max-Age=2592000/);
 // A visible, otherwise untouched page sends its automatic heartbeat.
 const before=pulses;database.prepare('UPDATE _sessions SET expires_at=? WHERE token_hash=?').run(Date.now()+60*60*1000,hash);await page.clock.fastForward(5*60*1000+1000);await expect.poll(()=>pulses).toBeGreaterThan(before);await expect.poll(()=>database.prepare('SELECT expires_at FROM _sessions WHERE token_hash=?').get(hash)?.expires_at||0).toBeGreaterThan(Date.now()+29*day);
 const logout=await fetch(base+'/api/auth/logout?all=1',{method:'POST'});assert(logout.ok);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 const denied=await fetch(base+'/api/tables');assert.equal(denied.status,401);assert.equal(denied.headers.get('set-cookie'),null);
 const expired=await fetch(base+'/api/auth/session');assert.equal((await expired.json()).user,null);assert.equal(expired.headers.get('set-cookie'),null);assert.equal(database.prepare('SELECT count(*) n FROM _sessions WHERE token_hash=?').get(hash).n,0);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie:'none=1'},body:JSON.stringify({email:'a@example.com',password:'TestPassword123'})});assert(login.ok);assert.match(login.headers.get('set-cookie'),/Max-Age=2592000/);
 console.log('Session renewal passed: 30-day persistent HttpOnly cookie, valid legacy upgrade, authenticated API renewal, visible-page heartbeat, logout-all, revoked session rejection and no resurrection.');
}finally{database.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
