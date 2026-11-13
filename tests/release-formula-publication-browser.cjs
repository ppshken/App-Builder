const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!base||!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,cookie=owner,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let sequence=0;const draft=()=>api('/api/releases','POST',{op:'create',label:'Formula release fixture '+(++sequence),mode:'development'});
async function rehearse(d,expected='passed'){const r=await api('/api/releases?id='+d.id);await api('/api/releases','POST',{op:'queue_rehearsal',id:d.id,rehearsal_hash:r.rehearsal_hash});for(let i=0;i<240;i++){const j=await api('/api/releases?id='+d.id+'&job=1');if(!['queued','running'].includes(j.status)){assert.equal(j.status,expected,JSON.stringify(j));return;}await pause(250);}throw Error('Rehearsal timeout');}
const ready=d=>api('/api/releases?id='+d.id+'&publication=1');
const publish=(d,p,status=200)=>api('/api/releases','POST',{op:'publish_development',id:d.id,intent_hash:p.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},owner,status);
(async()=>{let browser;const native=new Database(dbPath);try{
 await api('/api/tables','POST',{name:'formula_rows',label:'Formula rows',columns:[{name:'amount',label:'Amount',type:'number'}]});await api('/api/data/formula_rows','POST',{amount:2});
 const d=await draft(),dc=owner+'; nocode_draft='+d.id;
 await api('/api/tables/formula_rows','PATCH',{op:'add_column',column:{name:'memo',label:'Memo',type:'text'}},dc);
 await api('/api/tables/formula_rows','PATCH',{op:'add_column',column:{name:'score',label:'Score',type:'number',is_virtual:1,virtual_expr:'10 / [amount]'}},dc);
 assert.equal(native.prepare("SELECT count(*) n FROM _columns WHERE table_name='formula_rows' AND name='score'").get().n,0);
 await rehearse(d);const p=await ready(d);assert.equal(p.eligible,true,JSON.stringify(p));assert.equal(p.validatesRows,true);
 // This row was not present in the passed rehearsal. Live validation must see it.
 await api('/api/data/formula_rows','POST',{amount:0});const invalidLatest=await publish(d,p,409);assert.equal(invalidLatest.validation.rowIssues[0].column,'score');assert.equal(invalidLatest.validation.rowIssues[0].count,1);
 assert.equal(native.prepare("SELECT count(*) n FROM _columns WHERE table_name='formula_rows' AND name='score'").get().n,0);
 assert.equal(native.prepare('SELECT count(*) n FROM _app_versions WHERE id=?').get(d.id).n,0);
 assert.ok(!native.pragma('table_info(t_formula_rows)').some(c=>c.name==='memo'),'formula failure rolls physical DDL back too');
 assert.equal(native.prepare('SELECT count(*) n FROM t_formula_rows').get().n,2);
 await api('/api/tables/formula_rows','PATCH',{op:'edit_column',name:'score',virtual_expr:'IF([amount] = 0, 0, 10 / [amount])'},dc);
 await rehearse(d);const good=await ready(d);assert.equal(good.eligible,true,JSON.stringify(good));await publish(d,good);await publish(d,good);
 assert.equal(native.prepare("SELECT is_virtual FROM _columns WHERE table_name='formula_rows' AND name='score'").get().is_virtual,1);
 assert.ok(!native.pragma('table_info(t_formula_rows)').some(c=>c.name==='score'),'no physical column or row backfill');
 assert.ok(native.pragma('table_info(t_formula_rows)').some(c=>c.name==='memo'));
 assert.deepEqual(native.prepare('SELECT id,amount FROM t_formula_rows ORDER BY id').all(),[{id:1,amount:2},{id:2,amount:0}]);
 assert.equal(native.prepare('SELECT count(*) n FROM _app_versions WHERE id=?').get(d.id).n,1);
 assert.deepEqual((await api('/api/data/formula_rows')).sort((a,b)=>a.id-b.id).map(r=>r.score),[5,0]);
 // Existing virtual formula edits reuse the same publication transaction and row checks.
 const edit=await draft(),ec=owner+'; nocode_draft='+edit.id;
 await api('/api/tables/formula_rows','PATCH',{op:'edit_column',name:'score',virtual_expr:'[amount] * 3'},ec);await rehearse(edit);const ep=await ready(edit);assert.equal(ep.eligible,true,JSON.stringify(ep));await publish(edit,ep);
 assert.equal(native.prepare("SELECT virtual_expr FROM _columns WHERE table_name='formula_rows' AND name='score'").get().virtual_expr,'[amount] * 3');
 assert.deepEqual((await api('/api/data/formula_rows')).sort((a,b)=>a.id-b.id).map(r=>r.score),[6,0]);
 const invalid=await draft();await api('/api/tables/formula_rows','PATCH',{op:'edit_column',name:'score',virtual_expr:'1 / 0'},owner+'; nocode_draft='+invalid.id);await rehearse(invalid,'failed');assert.equal((await ready(invalid)).eligible,false);
 // Formula publication cannot implicitly convert stored columns or change their rules.
 const physical=await draft();await api('/api/tables/formula_rows','PATCH',{op:'edit_column',name:'amount',valid_if:'[_THIS] >= 0'},owner+'; nocode_draft='+physical.id);assert.ok(!(await ready(physical)).blockers.some(s=>s.includes('คอลัมน์จริง')));
 const capped=await draft();await api('/api/tables/formula_rows','PATCH',{op:'edit_column',name:'score',virtual_expr:'[amount] * 4'},owner+'; nocode_draft='+capped.id);
 native.transaction(()=>{const insert=native.prepare('INSERT INTO t_formula_rows(amount) VALUES(1)');for(let i=0;i<2000;i++)insert.run();})();
 await rehearse(capped);assert.equal((await ready(capped)).eligible,true);
 // Actual runtime renders the published result and the review UI explains the limit.
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();await context.addCookies([{name:owner.split('=')[0],value:owner.slice(owner.indexOf('=')+1),url:base}]);const page=await context.newPage();
 await page.goto(base+'/releases');await page.locator('article.health-issue').filter({hasText:capped.label}).getByRole('button',{name:'ตรวจและเผยแพร่',exact:true}).click();await expect(page.getByText('1,000,000',{exact:false}).first()).toBeVisible();
 await publish(capped,await ready(capped));
 console.log('PASS virtual addition/edit, latest live data rejection, atomic rollback, failed proof, no physical backfill, repeat safety, 2000-plus row publication and review UI');
}finally{await browser?.close();native.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
