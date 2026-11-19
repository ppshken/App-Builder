const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,file=process.env.NOCODE_TEST_DB;
if(!base||!file?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,status=200,cookie=owner){const r=await fetch(base+url,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const table=(name,columns)=>api('/api/tables','POST',{name,label:name,columns});
const preview=(name,target,mode='replace',column='value')=>api('/api/tables/'+name+'/convert','POST',{column,mode,target});
const apply=(name,p,status=200)=>api('/api/tables/'+name+'/convert','PUT',{token:p.token,confirmation:'แปลง'},status);
const rights={read:true,create:false,update:false,delete:false,export:false};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),db=new Database(file,{readonly:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addCookies([{name:owner.split('=')[0],value:owner.slice(owner.indexOf('=')+1),url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await table('audit_draft',[{name:'title',label:'Title',type:'text',is_label:true}]);const form=(await api('/api/views')).find(v=>v.table_name==='audit_draft'&&v.kind==='form');await page.goto(base+'/run?view='+form.name);await expect(page.locator('#data-title')).toBeVisible();
 for(const [suffix,width] of [['mobile',390],['desktop',1440]]){
  await page.setViewportSize({width,height:900});const text='Unsaved '+suffix+' draft';await page.locator('#data-title').fill(text);await page.evaluate(()=>window.__draftInput=document.querySelector('#data-title'));
  const accessRead=page.waitForResponse(r=>r.url().includes('/api/application-access')&&r.status()===200),viewRead=page.waitForResponse(r=>r.url().includes('/api/views?runtime=1')&&r.status()===200);
  await table('audit_other_'+suffix,[{name:'title',type:'text'}]);await accessRead;await viewRead;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await expect(page.locator('#data-title')).toHaveValue(text);assert.equal(await page.evaluate(()=>window.__draftInput===document.querySelector('#data-title')),true);assert.equal((await api('/api/data/audit_draft')).length,0);
 }
 fs.mkdirSync('artifacts/audit-four-fixes',{recursive:true});await page.screenshot({path:'artifacts/audit-four-fixes/retained-draft.png'});await page.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect.poll(async()=>(await api('/api/data/audit_draft')).length).toBe(1);
 console.log('PASS draft: unrelated table grants refresh navigation without remounting or submitting the mobile/desktop form.');

 await table('audit_rules',[{name:'value',type:'text'}]);for(const value of ['true','false'])await api('/api/data/audit_rules','POST',{value});
 const global=await api('/api/users','POST',{op:'create_role',label:'Audit global',builder:false,tables:{audit_rules:rights},actions:[],row_rules:{}});
 const reader=await api('/api/users','POST',{op:'create_user',name:'Audit Reader',nickname:'Audit',username:'audit_reader',department:'QA',email:'audit-reader@example.test',password:'SyntheticPassword123',role:global.name,active:true});
 const local=await api('/api/applications','PUT',{op:'app_role_create',id:'default',label:'Audit local',tables:{audit_rules:rights},actions:[],row_rules:{'audit_rules:read':'[value] = 1'}});
 const member=can_use=>api('/api/applications','PUT',{op:'app_member',id:'default',user_id:reader.id,can_use,role_name:can_use?local.name:null});await member(true);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'audit-reader@example.test',password:'SyntheticPassword123'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('/api/data/audit_rules','GET',undefined,200,cookie)).length,0);
 const blocked=await api('/api/tables/audit_rules/convert','POST',{column:'value',mode:'replace',target:{type:'yesno'}},400);assert.match(blocked.error,/สิทธิ์ระดับแถว/);
 const copied=await preview('audit_rules',{name:'copied',label:'Copied',type:'yesno'},'copy');assert.equal(copied.report.allowed,true,JSON.stringify(copied));await apply('audit_rules',copied);
 assert.deepEqual(db.prepare('SELECT value,copied FROM t_audit_rules ORDER BY id').all(),[{value:'true',copied:1},{value:'false',copied:0}]);assert.equal((await api('/api/data/audit_rules','GET',undefined,200,cookie)).length,0);
 await table('audit_stale_rule',[{name:'value',type:'text'}]);await api('/api/data/audit_stale_rule','POST',{value:'1'});const stale=await preview('audit_stale_rule',{type:'number'});assert.equal(stale.report.allowed,true);
 await api('/api/applications','PUT',{op:'app_role_create',id:'default',label:'Audit new rule',tables:{audit_stale_rule:rights},actions:[],row_rules:{'audit_stale_rule:read':'[value] = 1'}});await apply('audit_stale_rule',stale,409);
 assert.equal(db.prepare("SELECT type FROM _columns WHERE table_name='audit_stale_rule' AND name='value'").get().type,'text');
 console.log('PASS row rules: in-place conversion denied, copy keeps original access, edited app rule invalidates an old preview.');

 await table('audit_bad_user',[{name:'value',type:'text'}]);await api('/api/data/audit_bad_user','POST',{value:'999999'});const missing=await preview('audit_bad_user',{type:'user'});assert.equal(missing.report.allowed,false);assert.equal(missing.token,'');
 await table('audit_valid_user',[{name:'value',type:'text'}]);await api('/api/data/audit_valid_user','POST',{value:String(reader.id)});let valid=await preview('audit_valid_user',{type:'user'});assert.equal(valid.report.allowed,true,JSON.stringify(valid));
 await member(false);await apply('audit_valid_user',valid,409);assert.equal((await preview('audit_valid_user',{type:'user'})).report.allowed,false);
 await member(true);valid=await preview('audit_valid_user',{type:'user'});assert.equal(valid.report.allowed,true);await apply('audit_valid_user',valid);assert.equal(db.prepare('SELECT value FROM t_audit_valid_user').get().value,reader.id);await api('/api/data/audit_valid_user','POST',{value:999999},400);
 console.log('PASS User: nonexistent/nonmember rejected, membership change fences preview, eligible user converts and normal-save validation agrees.');

 for(const [name,expected] of [['audit_parent_old',1],['audit_parent_new',2]]){await table(name,[{name:'expected',type:'number'}]);await api('/api/data/'+name,'POST',{expected});}
 await table('audit_children',[{name:'parent',type:'ref',ref_table:'audit_parent_old',is_part_of:true,part_valid_if:'COUNT([_THIS]) = [expected]'},{name:'title',type:'text'}]);await api('/api/data/audit_children','POST',{parent:1,title:'One'});
 const target={type:'ref',ref_table:'audit_parent_new'},badPart=await preview('audit_children',target,'replace','parent');assert.equal(badPart.report.allowed,false,JSON.stringify(badPart));assert.ok(badPart.report.issues.some(i=>i.table==='audit_parent_new'));
 assert.equal(db.prepare("SELECT ref_table FROM _columns WHERE table_name='audit_children' AND name='parent'").get().ref_table,'audit_parent_old');
 await api('/api/data/audit_parent_new?id=1','PUT',{expected:1});const goodPart=await preview('audit_children',target,'replace','parent');assert.equal(goodPart.report.allowed,true,JSON.stringify(goodPart));await api('/api/data/audit_parent_new?id=1','PUT',{expected:2});await apply('audit_children',goodPart,409);
 await api('/api/data/audit_parent_new?id=1','PUT',{expected:1});const current=await preview('audit_children',target,'replace','parent');assert.equal(current.report.allowed,true);await apply('audit_children',current);
 assert.deepEqual(db.prepare('SELECT id,parent,title FROM t_audit_children').all(),[{id:1,parent:1,title:'One'}]);await api('/api/data/audit_parent_new?id=1','PUT',{expected:1});
 console.log('PASS child rules: bad target count rejected without mutation, changed parent invalidates preview, valid retarget preserves child IDs and normal parent save succeeds.');
 const app=await api('/api/applications','POST',{label:'Audit scoped conversion'},201),appCookie=owner+'; nocode_app='+app.id;
 await api('/api/tables','POST',{name:'audit_scoped_user',label:'Scoped User',columns:[{name:'value',type:'text'}]},200,appCookie);await api('/api/data/audit_scoped_user','POST',{value:String(reader.id)},200,appCookie);
 const scopedRequest={column:'value',mode:'replace',target:{type:'user'}};assert.equal((await api('/api/tables/audit_scoped_user/convert','POST',scopedRequest,200,appCookie)).report.allowed,false);
 const scopedRole=await api('/api/applications','PUT',{op:'app_role_create',id:app.id,label:'Scoped Reader',tables:{audit_scoped_user:rights},actions:[],row_rules:{}});await api('/api/applications','PUT',{op:'app_member',id:app.id,user_id:reader.id,can_use:true,role_name:scopedRole.name});
 const scopedPreview=await api('/api/tables/audit_scoped_user/convert','POST',scopedRequest,200,appCookie);assert.equal(scopedPreview.report.allowed,true,JSON.stringify(scopedPreview));await api('/api/tables/audit_scoped_user/convert','PUT',{token:scopedPreview.token,confirmation:'แปลง'},200,appCookie);
 assert.equal(db.prepare('SELECT value FROM t_audit_scoped_user').get().value,reader.id);console.log('PASS app isolation: default-app membership does not authorize User conversion in another app; explicit membership permits it.');
 assert.deepEqual(errors,[]);
 }finally{db.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
