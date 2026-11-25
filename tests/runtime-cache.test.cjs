const {test}=require('node:test'),assert=require('node:assert/strict');
const {runtimeJSON,clearRuntimeCache}=require('../.test-build/runtime-cache.js');
test('runtime reads deduplicate, isolate identities, expire and retry failed requests',async()=>{
 const original=global.fetch;let calls=0,release;
 try{clearRuntimeCache();global.fetch=async()=>{calls++;await new Promise(r=>release=r);return {ok:true,json:async()=>({value:calls})};};
 const first=runtimeJSON('/test','a'),second=runtimeJSON('/test','a');assert.equal(first,second);release();await first;assert.equal(calls,1);
 assert.equal(await runtimeJSON('/test','a'),await first);
 global.fetch=async()=>({ok:true,json:async()=>({value:++calls})});await runtimeJSON('/test','b');assert.equal(calls,2);
 await runtimeJSON('/expired','',-1);await runtimeJSON('/expired','',-1);assert.equal(calls,4);
 clearRuntimeCache();global.fetch=async()=>({ok:false,json:async()=>({error:'failed'})});await assert.rejects(runtimeJSON('/retry'),/failed/);
 global.fetch=async()=>({ok:true,json:async()=>({value:++calls})});await runtimeJSON('/retry');assert.equal(calls,5);
 }finally{global.fetch=original;clearRuntimeCache();}
});
test('data writes invalidate data and visibility while retaining table/view/action/slice definitions',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>({ok:true,json:async()=>++calls});
 try{clearRuntimeCache();const urls=['/api/tables','/api/views','/api/actions','/api/slices','/api/data/items?sort=id','/api/expression-data?table=items','/api/views?runtime=1'];
 await Promise.all(urls.map(u=>runtimeJSON(u)));assert.equal(calls,7);clearRuntimeCache('data');await Promise.all(urls.map(u=>runtimeJSON(u)));assert.equal(calls,10);
 }finally{global.fetch=original;clearRuntimeCache();}
});

test('list snapshots are bounded by session scope, expiry and write invalidation',()=>{
 const {configureRuntimeStorage,invalidateRuntimeLists,runtimeListEpoch,rememberRuntimeList,readRuntimeList}=require('../.test-build/runtime-cache.js');
 const originalNow=Date.now;
 try {
  Date.now=()=>1000;
  configureRuntimeStorage('first-session');
  const epoch=runtimeListEpoch(),value={payload:{rows:[{id:1}],total:1},versions:{}};
  rememberRuntimeList('query',value,epoch);
  assert.equal(readRuntimeList('query'),value);
  assert.equal(readRuntimeList('different-query'),undefined);
  invalidateRuntimeLists();
  rememberRuntimeList('query',value,epoch);
  assert.equal(readRuntimeList('query'),undefined);
  rememberRuntimeList('query',value,runtimeListEpoch());
  configureRuntimeStorage('other-session');
  assert.equal(readRuntimeList('query'),undefined);
  rememberRuntimeList('query',value,runtimeListEpoch());
  Date.now=()=>16_000;
  assert.equal(readRuntimeList('query'),undefined);
 }finally{Date.now=originalNow;configureRuntimeStorage('');}
});
