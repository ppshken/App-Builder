const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),D=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,file=process.env.NOCODE_TEST_DB;
if(!base||!file?.includes('integration-'))throw Error('Isolated integration database required');
async function api(url,method='GET',body,cookie=owner,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function rehearse(d,status='passed'){const r=await api('/api/releases?id='+d.id);await api('/api/releases','POST',{op:'queue_rehearsal',id:d.id,rehearsal_hash:r.rehearsal_hash});for(let i=0;i<300;i++){const job=await api('/api/releases?id='+d.id+'&job=1');if(!['queued','running'].includes(job.status)){assert.equal(job.status,status,JSON.stringify(job));return job;}await pause(200);}throw Error('Rehearsal timeout');}
const ready=d=>api('/api/releases?id='+d.id+'&publication=1');
const publish=(d,r,status=200)=>api('/api/releases','POST',{op:'publish_development',id:d.id,intent_hash:r.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},owner,status);
(async()=>{let browser;const live=new D(file,{readonly:true});try{
 await api('/api/tables','POST',{name:'seed_old',label:'Existing fixture',columns:[{name:'title',type:'text'}]});await api('/api/data/seed_old','POST',{title:'Keep original'});
 const draft=await api('/api/releases','POST',{op:'create',label:'Child and seed publication',mode:'development'}),dc=owner+'; nocode_draft='+draft.id;
 await api('/api/tables','POST',{name:'seed_root',label:'New parents',columns:[{name:'title',label:'Title',type:'text'},{name:'old_ref',type:'ref',ref_table:'seed_old'}]},dc);
 await api('/api/tables','POST',{name:'seed_children',label:'New children',columns:[{name:'title',type:'text'},{name:'parent',label:'Parent',type:'ref',ref_table:'seed_root'}]},dc);
 await api('/api/data/seed_root','POST',{title:'Independent parent'},dc);await api('/api/data/seed_root','POST',{title:'Connected to old',old_ref:1},dc);
 for(const [title,parent] of [['child one',1],['child two',1],['excluded child',2]])await api('/api/data/seed_children','POST',{title,parent},dc);
 // Rehearse a new Ref column with child rules, not only edits to an existing Ref.
 await api('/api/tables/seed_children','PATCH',{op:'edit_column',name:'parent',is_part_of:true,related_required:true,part_valid_if:'COUNT([_THIS]) = 2',part_invalid_value_error:'Need exactly two children'},dc);
 await rehearse(draft);let review=await ready(draft);assert.equal(review.eligible,true,JSON.stringify(review));assert.deepEqual(review.seedData.map(t=>[t.table,t.included,t.skipped]),[['seed_children',2,1],['seed_root',1,1]]);
 // Data-only changes invalidate proof and intent even when metadata is identical.
 const child=(await api('/api/data/seed_children?id=1','GET',undefined,dc))[0];await api('/api/data/seed_children?id=1','PUT',{title:'Updated seed value',parent:1,__version:child.__version},dc);
 assert.equal((await ready(draft)).eligible,false);await publish(draft,review,409);assert.equal(live.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='t_seed_root'").get().n,0);
 await rehearse(draft);review=await ready(draft);assert.equal(review.eligible,true,JSON.stringify(review));
 browser=await chromium.launch({channel:process.env.NOCODE_BROWSER_CHANNEL||'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:owner.split('=')[0],value:owner.slice(owner.indexOf('=')+1),url:base}]);const page=await context.newPage();await page.goto(base+'/releases');await page.locator('article.health-issue').filter({hasText:draft.label}).getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();await expect(page.getByLabel('ข้อมูลตารางใหม่ที่จะเผยแพร่')).toContainText('New parents');await expect(page.getByLabel('ข้อมูลตารางใหม่ที่จะเผยแพร่')).toContainText('อ้างอิงข้อมูลเดิม');
 const result=await publish(draft,review);assert.equal(result.status,'committed');assert.equal((await publish(draft,review)).replayed,true);
 assert.deepEqual(live.prepare('SELECT id,title FROM t_seed_old').all(),[{id:1,title:'Keep original'}]);assert.deepEqual(live.prepare('SELECT id,title,old_ref FROM t_seed_root').all(),[{id:1,title:'Independent parent',old_ref:null}]);assert.deepEqual(live.prepare('SELECT id,title,parent FROM t_seed_children ORDER BY id').all(),[{id:1,title:'Updated seed value',parent:1},{id:2,title:'child two',parent:1}]);assert.equal(live.prepare("SELECT is_part_of FROM _columns WHERE table_name='seed_children' AND name='parent'").get().is_part_of,1);assert.deepEqual(live.pragma('foreign_key_check'),[]);
 // Publishing newly enabled constraints on existing tables must validate current parents.
 const invalid=await api('/api/releases','POST',{op:'create',label:'Child validation failure',mode:'development'}),ic=owner+'; nocode_draft='+invalid.id;
 await api('/api/tables/seed_children','PATCH',{op:'edit_column',name:'parent',part_valid_if:'COUNT([_THIS]) = 3'},ic);const failed=await rehearse(invalid,'failed');assert.ok(failed.result_json||failed.status==='failed');assert.equal((await ready(invalid)).eligible,false);assert.equal(live.prepare("SELECT part_valid_if FROM _columns WHERE table_name='seed_children' AND name='parent'").get().part_valid_if,'COUNT([_THIS]) = 2');
 console.log('PASS child rule publication, row-level seed filtering, dependent exclusions, retained IDs, changed seed proof rejection, actual worker validation, replay, UI summary and existing row preservation');
 }finally{await browser?.close();live.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
