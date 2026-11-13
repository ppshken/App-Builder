const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),Database=require('better-sqlite3'),path=require('node:path'),fs=require('node:fs');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!base||!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,cookie=owner,status=200){
 const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();assert.equal(response.status,status,url+' '+JSON.stringify(data));return data;
}
const cookieFor=(draft,cookie=owner)=>cookie+'; nocode_draft='+draft.id;
function draftDatabase(id){
 const database=new Database(path.join(path.dirname(dbPath),'.app-releases',id+'.db'));
 database.function('nocode_audit_enabled',()=>0);database.function('nocode_audit_entries',{varargs:true},()=> '[]');return database;
}
(async()=>{
 await api('/api/tables','POST',{name:'plan_rows',label:'Plan rows',columns:[{name:'title',label:'Title',type:'text',is_label:true},{name:'qty',label:'Quantity',type:'number'}]});
 const row=await api('/api/data/plan_rows','POST',{title:'Original',qty:1});
 const views=await api('/api/views'),view=views.find(v=>v.table_name==='plan_rows'&&v.position==='primary');
 const draft=await api('/api/releases','POST',{op:'create',label:'Review configuration'});
 await api('/api/views','PUT',{...view,label:'Reviewed view'},cookieFor(draft));
 await api('/api/data/plan_rows?id='+row.id,'PUT',{title:'Draft data',qty:999},cookieFor(draft));
 const first=await api('/api/releases?id='+draft.id);
 assert.equal(first.plan.mode,'read-only');assert.equal(first.plan.summary.configuration,1);assert.equal(first.plan.publishBlocked,false);
 await api('/api/data/plan_rows','POST',{title:'Added while developing',qty:2});
 const liveDb=new Database(dbPath,{readonly:true}),draftDb=draftDatabase(draft.id);
 const state=()=>JSON.stringify({live:liveDb.prepare('SELECT * FROM t_plan_rows ORDER BY id').all(),columns:liveDb.prepare('SELECT * FROM _columns ORDER BY id').all(),views:liveDb.prepare('SELECT * FROM _views ORDER BY name').all(),draftRows:draftDb.prepare('SELECT * FROM t_plan_rows ORDER BY id').all(),draftViews:draftDb.prepare('SELECT * FROM _views ORDER BY name').all()});
 const before=state();
 const again=await api('/api/releases?id='+draft.id);assert.deepEqual(again.plan,first.plan);assert.equal(again.conflict,false);assert.equal(state(),before,'review cannot change live or draft business rows/configuration');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),[name,...value]=owner.split('=');
  await context.addCookies([{name,value:value.join('='),url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const review=async label=>{await page.goto(base+'/releases');const card=page.locator('.health-issue').filter({has:page.getByText(label,{exact:true})});await card.getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();await expect(page.getByRole('region',{name:'ผลเปรียบเทียบและผลกระทบ'})).toBeVisible();};
  await review('Review configuration');const panel=page.locator('.release-plan');await expect(panel).toContainText('ไม่มีการเปลี่ยนข้อมูลจากการตรวจนี้');await expect(panel.locator('.release-plan-operation')).toHaveCount(1);
  await panel.locator('.release-plan-operation summary').click();await expect(panel).toContainText('Reviewed view');await expect(panel).not.toContainText('Draft data');
  assert.equal(state(),before);
  fs.mkdirSync('artifacts',{recursive:true});await panel.screenshot({path:'artifacts/release-plan-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await panel.screenshot({path:'artifacts/release-plan-mobile.png'});
  await page.emulateMedia({colorScheme:'dark'});await panel.screenshot({path:'artifacts/release-plan-dark.png'});await page.emulateMedia({colorScheme:'light'});
  await page.getByRole('textbox',{name:'ยืนยันเผยแพร่',exact:true}).fill('เผยแพร่');await page.getByRole('button',{name:'เผยแพร่การตั้งค่า',exact:true}).click();
  await expect.poll(async()=>(await api('/api/views')).find(v=>v.name===view.name).label).toBe('Reviewed view');
  assert.deepEqual(liveDb.prepare('SELECT title,qty FROM t_plan_rows ORDER BY id').all(),[{title:'Original',qty:1},{title:'Added while developing',qty:2}]);
  console.log('PASS configuration review is read-only; live writes do not invalidate the plan; UI publish preserves latest data and excludes draft rows');

  const conflict=await api('/api/releases','POST',{op:'create',label:'Review conflict'}),currentView=(await api('/api/views')).find(v=>v.name===view.name);
  await api('/api/views','PUT',{...currentView,label:'Draft conflicting view'},cookieFor(conflict));await api('/api/views','PUT',{...currentView,label:'Live conflicting view'});
  const report=await api('/api/releases?id='+conflict.id);assert.equal(report.plan.summary.conflicts,1);assert.equal(report.plan.publishBlocked,true);
  await review('Review conflict');await expect(panel).toContainText('พบการแก้ไขรายการเดียวกัน');await page.getByRole('textbox',{name:'ยืนยันเผยแพร่',exact:true}).fill('เผยแพร่');await expect(page.getByRole('button',{name:'เผยแพร่การตั้งค่า',exact:true})).toBeDisabled();
  await api('/api/releases','POST',{op:'publish',id:conflict.id,review_hash:report.review_hash,confirmation:'เผยแพร่'},owner,409);
  console.log('PASS concurrent configuration changes conflict; UI and existing backend reject stale publication');

  const structural=await api('/api/releases','POST',{op:'create',label:'Review schema'}),structDb=draftDatabase(structural.id);
  // Synthetic draft metadata exercises preview of unsupported future changes without unlocking structural APIs.
  structDb.prepare("UPDATE _columns SET type='longtext' WHERE table_name='plan_rows' AND name='title'").run();
  const schemaBefore=JSON.stringify(liveDb.prepare('SELECT * FROM _columns ORDER BY id').all()),schemaReport=await api('/api/releases?id='+structural.id);
  assert.equal(schemaReport.plan.summary.schema,1);assert.equal(schemaReport.plan.operations[0].supported,false);assert.equal(JSON.stringify(liveDb.prepare('SELECT * FROM _columns ORDER BY id').all()),schemaBefore);
  await review('Review schema');await expect(panel).toContainText('ยังไม่รองรับเผยแพร่');await page.getByRole('textbox',{name:'ยืนยันเผยแพร่',exact:true}).fill('เผยแพร่');await expect(page.getByRole('button',{name:'เผยแพร่การตั้งค่า',exact:true})).toBeDisabled();
  await api('/api/releases','POST',{op:'publish',id:structural.id,review_hash:schemaReport.review_hash,confirmation:'เผยแพร่'},owner,409);
  await api('/api/tables','POST',{name:'not_allowed',label:'Blocked',columns:[{name:'title',type:'text'}]},cookieFor(structural),409);
  assert.equal(JSON.stringify(liveDb.prepare('SELECT * FROM _columns ORDER BY id').all()),schemaBefore);structDb.close();
  console.log('PASS structural changes are previewable but blocked; existing schema restrictions and live metadata remain intact');

  const role=await api('/api/users','POST',{op:'create_role',label:'Plan reader denied',builder:false,tables:{},actions:[]});
  await api('/api/users','POST',{op:'create_user',name:'Plan staff',email:'plan-staff@example.test',password:'SyntheticPassword123',role:role.name,active:true});
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'plan-staff@example.test',password:'SyntheticPassword123'})});assert.equal(login.status,200);const staff=login.headers.get('set-cookie').split(';')[0];await api('/api/releases?id='+structural.id,'GET',undefined,staff,403);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS non-builders cannot read release plans; desktop/mobile/dark rendering has no browser errors');
 }finally{await browser.close();draftDb.close();liveDb.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
