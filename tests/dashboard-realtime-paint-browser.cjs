const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated database required');
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
}
(async()=>{
 await api('/api/tables','POST',{name:'paint_rows',label:'Paint rows',columns:[{name:'category',label:'Category',type:'text'}]});
 await api('/api/tables/paint_rows','PATCH',{op:'realtime',enabled:true});
 await api('/api/data/paint_rows','POST',{category:'Before'});
 for(const name of ['paint_a','paint_b'])await api('/api/views','POST',{name,label:name,kind:'chart',table_name:'paint_rows',position:'menu',pos:1,columns:[],sort_column:'id',sort_dir:'asc',display:{chart_category:'category',chart_aggregate:'count'}});
 await api('/api/views','POST',{name:'paint_dashboard',label:'Paint dashboard',kind:'dashboard',position:'primary',pos:1,columns:[],sort_column:'id',sort_dir:'asc',display:{dashboard_views:['paint_a','paint_b'],dashboard_layout:'grid',dashboard_columns:2}});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(base+'/run?view=paint_dashboard');
  await expect(page.locator('.dashboard-panel .chart-view')).toHaveCount(2);
  let release;const gate=new Promise(resolve=>{release=resolve;});let requests=0;
  await page.route('**/api/view-data/paint_rows?*',async route=>{requests++;await gate;await route.continue();});
  await api('/api/data/paint_rows','POST',{category:'After'});
  await expect.poll(()=>requests,{timeout:20000}).toBeGreaterThan(0);
  await expect(page.locator('.dashboard-panel .chart-view')).toHaveCount(2);
  assert.equal(requests,1,'Shared chart data should be fetched once during refresh');
  release();
  await expect(page.locator('.dashboard-panel').first()).toContainText('After');
  await expect(page.locator('.dashboard-panel').last()).toContainText('After');
  console.log('PASS two dashboard charts remain mounted during delayed realtime refresh, share one request, and show fresh data');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
