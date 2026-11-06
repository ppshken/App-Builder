const {chromium,expect:baseExpect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('fs');
const expect=baseExpect.configure({timeout:20000}),base=process.env.NOCODE_TEST_URL;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated database required');
async function api(url,method='GET',body,status=200,cookie){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
(async()=>{
 await api('/api/tables','POST',{name:'scale_parents',label:'Scale parents',columns:[{name:'title',label:'Title',type:'text',is_label:true}]});
 await api('/api/tables','POST',{name:'scale_lines',label:'Scale lines',columns:[{name:'parent_id',label:'Parent',type:'ref',ref_table:'scale_parents'},{name:'score',label:'Score',type:'number'}]});
 const db=new Database(process.env.NOCODE_TEST_DB);db.pragma('foreign_keys=ON');try{
  db.transaction(()=>{db.exec("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<42858) INSERT INTO t_scale_parents(id,title) SELECT x,'Parent '||x FROM n;WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<300000) INSERT INTO t_scale_lines(id,parent_id,score) SELECT x,CAST((x-1)/7 AS INTEGER)+1,(x-1)%7+1 FROM n");})();
  const plan=db.prepare('EXPLAIN QUERY PLAN SELECT * FROM t_scale_lines WHERE parent_id IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 10001').all('[1]');assert.ok(plan.some(r=>r.detail.includes('_ref_scale_lines_parent_id')));
  fs.writeFileSync('.test-data/related-scale-query-plan.json',JSON.stringify({children:300000,parents:42858,plan},null,2));
 }finally{db.close();}
 for(const column of [{name:'line_count',label:'Line count',type:'number',is_virtual:true,virtual_expr:'COUNT([Related_scale_lines])'},{name:'score_total',label:'Score total',type:'number',is_virtual:true,virtual_expr:'SUM([Related_scale_lines][score])'}])await api('/api/tables/scale_parents','PATCH',{op:'add_column',column});
 const times=[];for(let i=0;i<8;i++){const start=performance.now(),rows=await api('/api/data/scale_parents?id=1');times.push(performance.now()-start);assert.equal(rows[0].line_count,7);assert.equal(rows[0].score_total,28);}
 const snap=await api('/api/expression-data?table=scale_parents&related_parent_ids=%5B1%5D');assert.equal(snap.scale_lines.rows.length,7);assert.deepEqual(snap.scale_lines.related_scope.parentIds,[1]);
 const empty=await api('/api/expression-data?table=scale_parents&related_parent_ids=%5B%5D');assert.equal(empty.scale_lines.rows.length,0);
 await api('/api/expression-data?table=scale_parents&related_parent_ids=%5B-1%5D','GET',undefined,400);
 const role=await api('/api/users','POST',{op:'create_role',label:'Scale reader',builder:false,tables:{scale_parents:{read:true,create:false,update:false,delete:false},scale_lines:{read:true,create:false,update:false,delete:false}},actions:[],row_rules:{'scale_parents:read':'[id] = 1','scale_lines:read':'[score] <= 3'}});
 await api('/api/users','POST',{op:'create_user',name:'Scale Reader',nickname:'Reader',department:'QA',username:'scale_reader',email:'scale@example.test',password:'ScalePass123',role:role.name,active:true});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie:''},body:JSON.stringify({username:'scale_reader',password:'ScalePass123'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const limited=await api('/api/data/scale_parents?id=1','GET',undefined,200,cookie);assert.equal(limited[0].line_count,3);assert.equal(limited[0].score_total,6);
 const limitedSnap=await api('/api/expression-data?table=scale_parents&related_parent_ids=%5B1,2%5D','GET',undefined,200,cookie);assert.equal(limitedSnap.scale_lines.rows.length,3);assert.deepEqual(limitedSnap.scale_lines.related_scope.parentIds,[1]);
 const views=await api('/api/views'),primary=views.find(v=>v.table_name==='scale_parents'&&v.position==='primary'),detail=views.find(v=>v.table_name==='scale_parents'&&v.kind==='detail');
 await api('/api/views','PUT',{...primary,sort_column:'id',sort_dir:'asc'});
 const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/run?view='+primary.name);await expect(page.getByRole('button',{name:'ดูรายละเอียด Parent 1',exact:true})).toBeVisible();
  await page.goto(base+'/run?view='+detail.name+'&row=1');await expect(page.locator('.detail-fields')).toContainText('28');
  await page.goto(base+'/t/scale_parents?row=1&edit=1');const dialog=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});await expect(dialog.locator('#data-line_count')).toHaveText('7');await expect(dialog.locator('#data-score_total')).toHaveText('28');await dialog.getByLabel('Title',{exact:false}).fill('Changed parent');await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();assert.equal((await api('/api/data/scale_parents?id=1'))[0].score_total,28);
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/run?view='+detail.name+'&row=2');await expect(page.locator('.detail-fields')).toContainText('28');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 times.sort((a,b)=>a-b);const benchmark={children:300000,childrenForParent:7,returnedSnapshotRows:7,httpSamplesMs:times,medianHttpMs:times[Math.floor(times.length/2)],note:'Local isolated database; HTTP timings include server work and are not a production SLA.'};fs.writeFileSync('.test-data/related-scale-benchmark.json',JSON.stringify(benchmark,null,2));
 console.log('PASS Related with 300,000 child rows: indexed parent lookup, COUNT/SUM, bounded scoped snapshots, parent/child row permissions, table/detail/form/save and mobile.');
})().catch(e=>{console.error(e);process.exitCode=1;});
