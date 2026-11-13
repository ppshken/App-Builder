const assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL,cookie=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,expected=200,auth=cookie){const r=await fetch(base+url,{method,headers:{cookie:auth,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
(async()=>{
 await api('/api/tables','POST',{name:'gate_rows',label:'Gate fixture',columns:[{name:'title',type:'text'}]});await api('/api/data/gate_rows','POST',{title:'Keep live'});
 const d=await api('/api/releases','POST',{op:'create',label:'Disabled publication fixture',mode:'development'});
 await api('/api/tables/gate_rows','PATCH',{op:'add_column',column:{name:'memo',type:'text'}},200,cookie+'; nocode_draft='+d.id);
 const review=await api('/api/releases?id='+d.id);await api('/api/releases','POST',{op:'queue_rehearsal',id:d.id,rehearsal_hash:review.rehearsal_hash});
 let passed=false;for(let i=0;i<240;i++){const job=await api('/api/releases?id='+d.id+'&job=1');if(!['queued','running'].includes(job.status)){assert.equal(job.status,'passed',JSON.stringify(job));passed=true;break;}await new Promise(r=>setTimeout(r,250));}assert(passed,'rehearsal must remain usable');
 const p=await api('/api/releases?id='+d.id+'&publication=1');assert.equal(p.eligible,false);assert.ok(p.rehearsalId);assert.ok(p.blockers.some(s=>s.includes('NOCODE_SCHEMA_PUBLICATION=1')));
 await api('/api/releases','POST',{op:'publish_development',id:d.id,intent_hash:p.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},409);
 const db=new Database(dbPath,{readonly:true});try{assert.ok(!db.pragma('table_info(t_gate_rows)').some(c=>c.name==='memo'));assert.equal(db.prepare('SELECT count(*) n FROM _app_versions WHERE id=?').get(d.id).n,0);assert.equal(db.prepare('SELECT title FROM t_gate_rows').get().title,'Keep live');}finally{db.close();}
 assert.equal((await api('/api/data/gate_rows'))[0].title,'Keep live');
 console.log('PASS disabled server gate rejects direct publication API even with passed rehearsal; runtime, data and rehearsal remain usable');
})().catch(e=>{console.error(e);process.exitCode=1;});
