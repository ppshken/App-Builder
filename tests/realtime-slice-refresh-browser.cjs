const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');const base=process.env.NOCODE_TEST_URL;if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await api('/api/tables','POST',{name:'rt_slice_rows',label:'Realtime slice',columns:[{name:'title',label:'Title',type:'text',is_label:true},{name:'status',label:'Status',type:'number'}]});const first=await api('/api/data/rt_slice_rows','POST',{title:'First',status:3}),second=await api('/api/data/rt_slice_rows','POST',{title:'Second',status:1});await api('/api/tables/rt_slice_rows','PATCH',{op:'realtime',enabled:true});await api('/api/slices','POST',{name:'rt_three',label:'Three',table_name:'rt_slice_rows',filter_expr:'[status] = 3',columns:[]});await api('/api/views','POST',{name:'rt_view',label:'Realtime View',kind:'table',position:'primary',table_name:'rt_slice_rows',slice_name:'rt_three',columns:['title','status'],sort_column:'id',sort_dir:'asc',pos:0});await api('/api/tables','POST',{name:'rt_other',label:'Other view',columns:[{name:'title',type:'text',is_label:true}]});const other=(await api('/api/views')).find(v=>v.table_name==='rt_other'&&v.position==='primary');const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1400,height:900}});let reads=0,versions={},slow=false,active=0,maxActive=0;const isRead=url=>url.pathname==='/api/data/rt_slice_rows'&&url.searchParams.has('slice')&&!url.searchParams.has('id');page.on('request',r=>{if(r.method()==='GET'&&isRead(new URL(r.url())))reads++;});page.on('response',async r=>{if(isRead(new URL(r.url()))&&r.status()===200){const header=await r.headerValue('x-nocode-realtime-versions');if(header)versions=JSON.parse(header);}});await page.route('**/api/data/rt_slice_rows?**',async route=>{if(!slow||route.request().method()!=='GET'||!isRead(new URL(route.request().url())))return route.continue();maxActive=Math.max(maxActive,++active);try{const response=await route.fetch();await sleep(1800);await route.fulfill({response});}finally{active--;}});await page.goto(base+'/run?view=rt_view');const table=page.locator('.runtime-route:not([hidden]) .record-table');await expect(table).toContainText('First');await sleep(1800);assert.equal(reads,1,'initial SSE snapshot must not duplicate an already covered read');assert.ok(versions.rt_slice_rows);const emit=async(count,revision,accessChanged=false)=>page.evaluate(({count,revision,accessChanged})=>{for(let i=0;i<count;i++)window.dispatchEvent(new CustomEvent('nocode:realtime-data',{detail:{tables:['rt_slice_rows'],revisions:{rt_slice_rows:revision},accessChanged}}));},{count,revision,accessChanged});let before=reads;await emit(20,versions.rt_slice_rows);await sleep(1200);assert.equal(reads,before,'covered versions should not reload');await emit(20,'synthetic:next');await expect.poll(()=>reads).toBe(before+1);await sleep(800);assert.equal(reads,before+1,'burst should become one read');before=reads;await emit(1,versions.rt_slice_rows,true);await expect.poll(()=>reads).toBe(before+1);await sleep(800);slow=true;const abort=new AbortController(),stream=await fetch(base+'/api/realtime?app=default',{signal:abort.signal}),reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/event: snapshot/);const nextRead=page.waitForRequest(r=>r.method()==='GET'&&isRead(new URL(r.url())));await api('/api/data/rt_slice_rows?id='+second.id,'PUT',{title:'Second',status:3});const update=await Promise.race([reader.read().then(x=>new TextDecoder().decode(x.value)),sleep(5000).then(()=> 'no snapshot')]);assert.match(update,/rt_slice_rows.*0:2/);abort.abort();await nextRead;await api('/api/data/rt_slice_rows?id='+second.id,'PUT',{title:'Newest during refresh',status:3});await expect(page.locator('.runtime-refresh-indicator')).toHaveCount(0);await expect(table).toContainText('First');await expect(table).toContainText('Newest during refresh',{timeout:10000});assert.equal(maxActive,1);await api('/api/data/rt_slice_rows?id='+first.id,'PUT',{title:'First',status:1});await expect(table).not.toContainText('First');slow=false;await sleep(800);before=reads;await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await api('/api/data/rt_slice_rows?id='+second.id,'PUT',{title:'Changed while hidden',status:3});await emit(10,'hidden:next');await sleep(1200);assert.equal(reads,before,'hidden document must defer reload');await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});await expect(table).toContainText('Changed while hidden');await page.getByRole('navigation',{name:'Menu Navigation',exact:true}).getByRole('button',{name:other.label,exact:true}).click();await expect(page.locator('.runtime-transition')).toHaveAttribute('aria-busy','false');await sleep(600);before=reads;await api('/api/data/rt_slice_rows?id='+second.id,'PUT',{title:'Changed in another view',status:3});await sleep(1800);assert.equal(reads,before,'cached inactive route must not reload');await page.getByRole('navigation',{name:'Menu Navigation',exact:true}).getByRole('button',{name:'Realtime View',exact:true}).click();await expect(table).toContainText('Changed in another view');await api('/api/tables','POST',{name:'rt_private',label:'Private version',columns:[{name:'title',type:'text'}]});await api('/api/tables/rt_private','PATCH',{op:'realtime',enabled:true});const role=await api('/api/users','POST',{op:'create_role',label:'Realtime scoped',builder:false,tables:{rt_slice_rows:{read:true,create:false,update:false,delete:false}},actions:[]});await api('/api/users','POST',{op:'create_user',name:'Realtime scoped',username:'rt_scoped',nickname:'Scoped',department:'QA',email:'',password:'1234',role:role.name,active:true});const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie:'none=1'},body:JSON.stringify({username:'rt_scoped',password:'1234'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],scoped=await fetch(base+'/api/data/rt_slice_rows?all=1&slice=rt_three',{headers:{cookie}});assert.equal(scoped.status,200);const header=JSON.parse(scoped.headers.get('x-nocode-realtime-versions'));assert.ok(header.rt_slice_rows);assert.equal(header.rt_private,undefined);

await api('/api/views','POST',{name:'rt_dashboard',label:'Realtime dashboard',kind:'dashboard',position:'primary',pos:3,table_name:'',columns:[],sort_column:'id',sort_dir:'asc',display:{dashboard_views:['rt_view',other.name],dashboard_layout:'auto'}});
const sessions=await Promise.all([browser.newPage({viewport:{width:1440,height:1000}}),browser.newPage({viewport:{width:1440,height:1000}})]);
const counts=sessions.map(()=>({related:0,unrelated:0,expressions:0}));
for(const [i,session] of sessions.entries())session.on('request',request=>{
 if(request.method()!=='GET')return;
 const path=new URL(request.url()).pathname;
 if(path==='/api/data/rt_slice_rows')counts[i].related++;
 if(path==='/api/data/rt_other')counts[i].unrelated++;
 if(path==='/api/expression-data')counts[i].expressions++;
});
await sessions[1].addInitScript(()=>{
 const NativeEventSource=window.EventSource;
 window.EventSource=class extends NativeEventSource{
  constructor(...args){
   super(...args);
   if(new URL(args[0],location.href).pathname!=='/api/realtime')return;
   this.addEventListener('snapshot',event=>{
    const revision=JSON.parse(event.data).tables?.rt_slice_rows;
    if(revision&&window.dashboardSnapshot?.revision!==revision)window.dashboardSnapshot={revision,at:performance.timeOrigin+performance.now()};
   });
  }
 };
});
await Promise.all(sessions.map(s=>s.goto(base+'/run?view=rt_dashboard')));
const panels=sessions.map(s=>s.locator('[data-dashboard-panel="rt_view"]'));
for(const panel of panels)await expect(panel).toContainText('Changed in another view');
await sleep(1000);
const search=sessions[0].locator('.dashboard-search input');
const initialReads=counts[0].related;
await search.fill('Changed in another view');
await expect.poll(()=>counts[0].related).toBe(initialReads+1);
await expect(panels[0]).toContainText('Changed in another view');
await expect(panels[0].locator('.runtime-search-loading')).toHaveCount(0);
await sleep(500);
await search.fill('');
await sleep(650);
await expect(panels[0]).toContainText('Changed in another view');
assert.equal(counts[0].related,initialReads+1,'Returning to the same query should reuse its in-memory list snapshot');
const metrics=[];
for(let i=0;i<5;i++){
 for(const count of counts)Object.assign(count,{related:0,unrelated:0,expressions:0});
 const title='Dashboard performance '+i,started=performance.now();
 const apiMs=await sessions[0].evaluate(async ({id,title})=>{
  const started=performance.now(),response=await fetch('/api/data/rt_slice_rows?id='+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,status:3})});
  if(!response.ok)throw Error('Save failed '+response.status);
  await response.json();
  return performance.now()-started;
 },{id:second.id,title});
 const visibleMs=await Promise.all(panels.map(async panel=>{await expect(panel).toContainText(title);return Math.round(performance.now()-started);}));
 await sleep(650);
 for(const count of counts){assert.equal(count.unrelated,0);assert.equal(count.related,1);}
 metrics.push({apiMs:Math.round(apiMs),visibleMs,reads:counts.map(count=>({...count}))});
}
console.log('Dashboard baseline '+JSON.stringify(metrics));

const editView=(await api('/api/views')).find(v=>v.table_name==='rt_slice_rows'&&v.kind==='form');
assert.ok(editView,'Expected generated edit form');
const [editor,viewer]=sessions;
const isSave=request=>request.method()==='PUT'&&new URL(request.url()).pathname==='/api/data/rt_slice_rows';
const formMetrics=[];
for(let i=0;i<5;i++){
 await editor.goto(base+'/run?view='+editView.name+'&row='+second.id);
 const title='Form performance '+i;
 await editor.locator('#data-title').fill(title);
 const saveButton=editor.getByRole('button',{name:/^บันทึกการแก้ไข$/});
 await expect(saveButton).toBeEnabled();
 const previousSnapshot=await viewer.evaluate(()=>window.dashboardSnapshot);
 Object.assign(counts[1],{related:0,unrelated:0,expressions:0});
 const started=performance.now();
 const saveSent=editor.waitForRequest(isSave).then(()=>performance.now());
 const saveResponse=editor.waitForResponse(response=>isSave(response.request())).then(response=>{assert.ok(response.ok(),'Form save failed');return performance.now();});
 const readSent=viewer.waitForRequest(request=>request.method()==='GET'&&isRead(new URL(request.url()))).then(()=>performance.now());
 const [sent,saved,read]=await Promise.all([saveSent,saveResponse,readSent,saveButton.click()]);
 await expect(panels[1]).toContainText(title);
 const visible=performance.now();
 const snapshot=await viewer.evaluate(()=>window.dashboardSnapshot);
 assert.ok(snapshot&&snapshot.revision!==previousSnapshot?.revision,'Expected an SSE snapshot covering the saved change');
 const snapshotAt=snapshot.at-performance.timeOrigin;
 await sleep(650);
 assert.equal(counts[1].unrelated,0);
 assert.equal(counts[1].related,1);
 formMetrics.push({clickToRequestMs:Math.round(sent-started),saveApiMs:Math.round(saved-sent),responseToDashboardReadMs:Math.round(read-saved),saveResponseToSseMs:Math.round(snapshotAt-saved),sseToDashboardReadMs:Math.round(read-snapshotAt),dashboardReadToVisibleMs:Math.round(visible-read),clickToVisibleMs:Math.round(visible-started),reads:{...counts[1]}});
}
console.log('Form save baseline '+JSON.stringify(formMetrics));
await Promise.all(sessions.map(s=>s.close()));
console.log('PASS real SSE Slice entry/exit, initial and covered-version deduplication, burst batching, quiet slow refresh, serialized reads, forced access refresh, hidden document and cached route catch-up');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});