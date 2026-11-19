const assert=require('node:assert/strict'),Database=require('better-sqlite3'),path=require('node:path');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!base||!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,cookie=owner,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function rehearse(d,cookie=owner){const review=await api('/api/releases?id='+d.id,'GET',undefined,cookie);await api('/api/releases','POST',{op:'queue_rehearsal',id:d.id,rehearsal_hash:review.rehearsal_hash},cookie);for(let i=0;i<240;i++){const j=await api('/api/releases?id='+d.id+'&job=1','GET',undefined,cookie);if(!['queued','running'].includes(j.status)){assert.equal(j.status,'passed',JSON.stringify(j));return;}await pause(250);}throw Error('Rehearsal timeout');}
async function convert(table,cookie,target){const p=await api('/api/tables/'+table+'/convert','POST',{column:'value',mode:'replace',target},cookie);assert.equal(p.report.allowed,true,JSON.stringify(p));await api('/api/tables/'+table+'/convert','PUT',{token:p.token,confirmation:'แปลง'},cookie);}
const ready=d=>api('/api/releases?id='+d.id+'&publication=1');
const publish=(d,p,status=200)=>api('/api/releases','POST',{op:'publish_development',id:d.id,intent_hash:p.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},owner,status);
(async()=>{const native=new Database(dbPath);try{
 for(const name of ['type_rows','type_empty'])await api('/api/tables','POST',{name,label:name,columns:[{name:'value',label:'Value',type:'text'}]});
 const a=await api('/api/data/type_rows','POST',{value:'A'}),b=await api('/api/data/type_rows','POST',{value:'B'});
 const d=await api('/api/releases','POST',{op:'create',label:'Preserving Text to Enum',mode:'development'}),dc=owner+'; nocode_draft='+d.id;
 for(const table of ['type_rows','type_empty'])await convert(table,dc,{type:'enum',options:'A,B'});
 assert.equal(native.prepare("SELECT type FROM _columns WHERE table_name='type_rows' AND name='value'").get().type,'text');
 await rehearse(d);const p=await ready(d);assert.equal(p.eligible,true,JSON.stringify(p));assert.equal(p.validatesRows,true);
 // A new value arriving after rehearsal must be validated using the Enum, not Text.
 const c=await api('/api/data/type_rows','POST',{value:'C'});const blocked=await publish(d,p,409);assert.ok(blocked.validation.rowIssues.some(i=>i.table==='type_rows'&&i.column==='value'));
 assert.equal(native.prepare("SELECT type FROM _columns WHERE table_name='type_rows' AND name='value'").get().type,'text');assert.equal(native.prepare('SELECT count(*) n FROM _app_versions WHERE id=?').get(d.id).n,0);
 assert.equal(native.prepare('SELECT value FROM t_type_rows WHERE id=?').get(c.id).value,'C');
 await api('/api/data/type_rows?id='+c.id,'PUT',{value:'A'});
 const before=native.prepare('SELECT * FROM t_type_rows ORDER BY id').all(),physical=native.prepare("SELECT name,sql FROM sqlite_master WHERE tbl_name='t_type_rows' ORDER BY name").all();
 const result=await publish(d,await ready(d));assert.equal(result.status,'committed');assert.equal((await publish(d,p)).replayed,true);
 for(const table of ['type_rows','type_empty'])assert.equal(native.prepare('SELECT type FROM _columns WHERE table_name=? AND name=?').get(table,'value').type,'enum');
 assert.deepEqual(native.prepare('SELECT * FROM t_type_rows ORDER BY id').all(),before);assert.deepEqual(native.prepare("SELECT name,sql FROM sqlite_master WHERE tbl_name='t_type_rows' ORDER BY name").all(),physical);assert.equal(native.prepare('SELECT count(*) n FROM t_type_empty').get().n,0);
 assert.deepEqual(before.map(r=>r.id),[a.id,b.id,c.id]);await api('/api/data/type_rows','POST',{value:'C'},owner,400);
 assert.equal(native.prepare('SELECT count(*) n FROM _app_versions WHERE id=?').get(d.id).n,1);
 const backup=new Database(path.join(path.dirname(dbPath),'backups',result.backup),{readonly:true});try{assert.equal(backup.prepare("SELECT type FROM _columns WHERE table_name='type_rows' AND name='value'").get().type,'text');assert.deepEqual(backup.prepare('SELECT * FROM t_type_rows ORDER BY id').all(),before);}finally{backup.close();}
 // Actual storage conversions remain blocked, even on a table with zero rows.
 const unsafe=await api('/api/releases','POST',{op:'create',label:'Storage conversion blocked',mode:'development'});
 await convert('type_empty',owner+'; nocode_draft='+unsafe.id,{type:'number'});assert.equal((await ready(unsafe)).eligible,false);
 // Named-app metadata and publication workers use the same app boundary.
 const app=await api('/api/applications','POST',{label:'Type publication app'},owner,201),ac=owner+'; nocode_app='+app.id;
 await api('/api/tables','POST',{name:'named_type_rows',label:'Named type',columns:[{name:'value',type:'text'}]},ac);await api('/api/data/named_type_rows','POST',{value:'A'},ac);
 const nd=await api('/api/releases','POST',{op:'create',label:'Named type release',mode:'development'},ac);
 await convert('named_type_rows',ac+'; nocode_draft='+nd.id,{type:'enum',options:'A,B'});await rehearse(nd,ac);
 const np=await api('/api/releases?id='+nd.id+'&publication=1','GET',undefined,ac);assert.equal(np.eligible,true,JSON.stringify(np));
 await api('/api/releases','POST',{op:'publish_development',id:nd.id,intent_hash:np.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},ac);
 assert.equal(native.prepare("SELECT type FROM _columns WHERE table_name='named_type_rows' AND name='value'").get().type,'enum');
 assert.deepEqual(native.prepare('SELECT id,value FROM t_named_type_rows').all(),[{id:1,value:'A'}]);assert.deepEqual(native.prepare('SELECT * FROM t_type_rows ORDER BY id').all(),before);
 console.log('PASS Text-to-Enum rehearsal/publication: empty and populated columns, unchanged rows/IDs/SQL, new invalid live row blocks commit, retry after correction, backup, idempotency, incompatible storage remains blocked.');
 }finally{native.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
