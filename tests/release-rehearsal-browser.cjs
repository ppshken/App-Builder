const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!base||!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,cookie=owner,status=200,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const draftCookie=d=>owner+'; nocode_draft='+d.id;
async function create(label){return api('/api/releases','POST',{op:'create',label,mode:'development'});}
async function review(d){return api('/api/releases?id='+d.id);}
async function run(d,hash){return api('/api/releases','POST',{op:'rehearse',id:d.id,rehearsal_hash:hash||(await review(d)).rehearsal_hash});}
(async()=>{
 const live=new Database(dbPath,{readonly:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 await api('/api/tables','POST',{name:'rehearsal_rows',label:'Rehearsal rows',columns:[{name:'title',label:'Title',type:'text'}]});
 await api('/api/data/rehearsal_rows','POST',{title:'Live before workspace'});
 const d=await create('Rehearsal success'),cookie=draftCookie(d);
 await api('/api/tables/rehearsal_rows','PATCH',{op:'add_column',column:{name:'memo',label:'Memo',type:'text'}},cookie);
 await api('/api/tables','POST',{name:'rehearsal_new',label:'Rehearsal new',columns:[{name:'title',label:'Title',type:'text'}]},cookie);
 await api('/api/data/rehearsal_new','POST',{title:'Never migrate this private fixture'},cookie);
 await api('/api/data/rehearsal_rows','POST',{title:'Live after workspace'});
 // Introduce a metadata ID collision in another app after workspace creation, without changing this app.
 const other=await api('/api/applications','POST',{label:'Rehearsal other app'},owner,201),otherCookie=owner+'; nocode_app='+other.id;
 await api('/api/tables','POST',{name:'rehearsal_other',label:'Other app table',columns:[{name:'title',type:'text'}]},otherCookie);
 // Global catalog drift is conservatively blocked by phase 1, so start a fresh workspace for the success case.
 const blocked=await run(d);assert.equal(blocked.status,'blocked',JSON.stringify(blocked));
 const fresh=await create('Rehearsal final'),freshCookie=draftCookie(fresh);
 await api('/api/tables/rehearsal_rows','PATCH',{op:'add_column',column:{name:'memo',label:'Memo',type:'text'}},freshCookie);
 await api('/api/tables','POST',{name:'rehearsal_new',label:'Rehearsal new',columns:[{name:'title',type:'text'}]},freshCookie);
 await api('/api/data/rehearsal_new','POST',{title:'Never migrate this private fixture'},freshCookie);
 await api('/api/data/rehearsal_rows','POST',{title:'Newest live row'});
 const before=JSON.stringify(live.prepare('SELECT * FROM t_rehearsal_rows').all());
 const result=await run(fresh);assert.equal(result.status,'passed',JSON.stringify(result));assert.equal(result.publishAllowed,false);assert.ok(result.checks.every(c=>c.passed));
 assert.deepEqual(result.tables.find(t=>t.table==='rehearsal_rows'),{table:'rehearsal_rows',before:3,after:3});assert.deepEqual(result.tables.find(t=>t.table==='rehearsal_new'),{table:'rehearsal_new',before:0,after:0});
 assert.ok(!JSON.stringify(result).includes('private fixture'));assert.equal((await review(fresh)).rehearsal.stale,false);
 assert.equal(JSON.stringify(live.prepare('SELECT * FROM t_rehearsal_rows').all()),before);assert.ok(!live.prepare("SELECT 1 FROM sqlite_master WHERE name='t_rehearsal_new'").get());assert.ok(!live.pragma('table_info(t_rehearsal_rows)').some(c=>c.name==='memo'));
 const dir=path.join(path.dirname(dbPath),'.app-releases',fresh.id);assert.ok(!fs.readdirSync(dir).some(n=>n.startsWith('rehearsal-')),'scratch database must be removed');
 const reportFile=path.join(path.dirname(dbPath),'.app-releases',fresh.id+'.rehearsal.json'),saved=JSON.parse(fs.readFileSync(reportFile,'utf8'));fs.writeFileSync(reportFile,JSON.stringify({...saved,expiresAt:Date.now()-1}));assert.equal((await review(fresh)).rehearsal.stale,true);fs.writeFileSync(reportFile,JSON.stringify(saved));
 const context=await browser.newContext({viewport:{width:1440,height:960}});const [name,...value]=owner.split('=');await context.addCookies([{name,value:value.join('='),url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/releases');await page.locator('article.health-issue').filter({hasText:'Rehearsal final'}).getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();
 const panel=page.getByRole('region',{name:'ซ้อมอัปเดต'});await expect(panel).toContainText('ซ้อมผ่านในสำเนา');await panel.getByRole('button',{name:'ซ้อมอัปเดต',exact:true}).click();await expect(panel).toContainText('ซ้อมผ่านในสำเนา');await expect(panel.getByRole('button')).toBeEnabled();
 fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/rehearsal-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/rehearsal-mobile.png'});assert.deepEqual(errors,[]);
 await api('/api/data/rehearsal_rows','POST',{title:'Live changed after rehearsal'});assert.equal((await review(fresh)).rehearsal.stale,true,'data-only change invalidates rehearsal');
 await api('/api/releases','POST',{op:'publish',id:fresh.id,review_hash:(await review(fresh)).review_hash,confirmation:'เผยแพร่'},owner,409);
 const staleHash=(await review(fresh)).rehearsal_hash;await api('/api/tables/rehearsal_rows','PATCH',{op:'add_column',column:{name:'extra',type:'text'}},freshCookie);await api('/api/releases','POST',{op:'rehearse',id:fresh.id,rehearsal_hash:staleHash},owner,409);
 await api('/api/releases','POST',{op:'rehearse',id:fresh.id,rehearsal_hash:(await review(fresh)).rehearsal_hash},'',401);
 await api('/api/releases','POST',{op:'rehearse',id:fresh.id,rehearsal_hash:(await review(fresh)).rehearsal_hash},owner,403,{Origin:'https://hostile.invalid'});
 const bad=await create('Rehearsal unsafe');await api('/api/tables/rehearsal_rows','PATCH',{op:'rename_column',name:'title',new_name:'renamed'},draftCookie(bad));assert.equal((await run(bad)).status,'blocked');
 const invalid=await create('Rehearsal invalid data');await api('/api/tables/rehearsal_rows','PATCH',{op:'add_column',column:{name:'virtual_bad',label:'Bad formula',type:'number',is_virtual:1,virtual_expr:'1 / 0'}},draftCookie(invalid));const failed=await run(invalid);assert.equal(failed.status,'failed');assert.ok(failed.checks.some(c=>c.code==='ROW_VALIDATION'&&!c.passed));
 assert.equal(live.prepare('SELECT count(*) n FROM t_rehearsal_rows').get().n,4);assert.ok(!live.pragma('table_info(t_rehearsal_rows)').some(c=>c.name==='virtual_bad'));
 assert.deepEqual(failed.rowIssues,[{table:'rehearsal_rows',tableLabel:'Rehearsal rows',column:'virtual_bad',columnLabel:'Bad formula',kind:'calculation',count:4}]);
 assert.ok(!JSON.stringify(failed.rowIssues).includes('Live before workspace'));
 await page.goto(base+'/releases');await page.locator('article.health-issue').filter({hasText:'Rehearsal invalid data'}).getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();
 const issues=page.getByRole('region',{name:'ซ้อมอัปเดต'}).getByLabel('จุดที่ข้อมูลไม่ผ่าน',{exact:true});await expect(issues).toBeVisible();await expect(issues.getByRole('cell',{name:'สูตรคำนวณหรือสูตรเงื่อนไขผิดพลาด',exact:true})).toBeVisible();await expect(issues.getByRole('cell',{name:'4',exact:true})).toBeVisible();await expect(issues).toContainText('virtual_bad');
 await issues.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/rehearsal-column-issues-mobile.png'});
 const appDraft=await api('/api/releases','POST',{op:'create',label:'App-specific rehearsal',mode:'development'},otherCookie),appDraftCookie=otherCookie+'; nocode_draft='+appDraft.id;
 await api('/api/tables','POST',{name:'rehearsal_app_new',label:'App new',columns:[{name:'title',type:'text'}]},appDraftCookie);
 const appReview=await api('/api/releases?id='+appDraft.id,'GET',undefined,otherCookie),appResult=await api('/api/releases','POST',{op:'rehearse',id:appDraft.id,rehearsal_hash:appReview.rehearsal_hash},otherCookie);assert.equal(appResult.status,'passed',JSON.stringify(appResult));assert.ok(!live.prepare("SELECT 1 FROM sqlite_master WHERE name='t_rehearsal_app_new'").get());
 await api('/api/releases','POST',{op:'rehearse',id:appDraft.id,rehearsal_hash:appReview.rehearsal_hash},otherCookie,409,{'x-nocode-app':'default'});
 await api('/api/applications','PUT',{op:'dataset',id:other.id,table:'rehearsal_rows',rights:{read:true,create:false,update:false,delete:false,export:false}});
 const shared=await create('Shared source blocked');await api('/api/tables/rehearsal_rows','PATCH',{op:'add_column',column:{name:'shared_extra',type:'text'}},draftCookie(shared));const sharedResult=await run(shared);assert.equal(sharedResult.status,'blocked');assert.ok(sharedResult.reasons.some(r=>r.includes('แอปอื่น')));
 await api('/api/tables','POST',{name:'rehearsal_large',label:'Large fixture',columns:[{name:'title',type:'text'}]});
 const write=new Database(dbPath);try{write.function('nocode_audit_enabled',()=>0);write.transaction(()=>{const insert=write.prepare('INSERT INTO t_rehearsal_large(title) VALUES(?)');for(let i=0;i<2001;i++)insert.run('Synthetic');})();}finally{write.close();}
 const large=await create('Bounded rehearsal');const limited=await run(large);assert.equal(limited.status,'failed');assert.equal(live.prepare('SELECT count(*) n FROM t_rehearsal_large').get().n,2001);assert.ok(!fs.readdirSync(path.join(path.dirname(dbPath),'.app-releases',large.id)).some(n=>n.startsWith('rehearsal-')));
 const role=await api('/api/users','POST',{op:'create_role',label:'Rehearsal denied',builder:false,tables:{},actions:[]});await api('/api/users','POST',{op:'create_user',name:'Rehearsal staff',email:'rehearsal-staff@example.test',password:'SyntheticPassword123',role:role.name,active:true});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'rehearsal-staff@example.test',password:'SyntheticPassword123'})});assert.equal(login.status,200);const staff=login.headers.get('set-cookie').split(';')[0];await api('/api/releases','POST',{op:'rehearse',id:fresh.id,rehearsal_hash:staleHash},staff,403);
 console.log('PASS latest-row snapshot, zero experimental data, schema/data preservation, private aggregate reports, failed/blocked states, stale plans/data, authentication/CSRF, UI and scratch cleanup');
 }finally{live.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
