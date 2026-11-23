const assert=require('node:assert/strict'),Database=require('better-sqlite3'),path=require('node:path');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE,dbPath=process.env.NOCODE_TEST_DB;
if(!base||!dbPath?.includes('integration-'))throw Error('Isolated runner required');
async function api(url,method='GET',body,cookie=owner,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function rehearse(d,cookie=owner){const review=await api('/api/releases?id='+d.id,'GET',undefined,cookie);await api('/api/releases','POST',{op:'queue_rehearsal',id:d.id,rehearsal_hash:review.rehearsal_hash},cookie);for(let i=0;i<240;i++){const j=await api('/api/releases?id='+d.id+'&job=1','GET',undefined,cookie);if(!['queued','running'].includes(j.status)){assert.equal(j.status,'passed',JSON.stringify(j));return;}await pause(250);}throw Error('Rehearsal timeout');}
async function convert(table,cookie,target,ref_match){const p=await api('/api/tables/'+table+'/convert','POST',{column:'value',mode:'replace',target,ref_match},cookie);assert.equal(p.report.allowed,true,JSON.stringify(p));await api('/api/tables/'+table+'/convert','PUT',{token:p.token,confirmation:'แปลง'},cookie);}
const ready=d=>api('/api/releases?id='+d.id+'&publication=1');
const publish=(d,p,status=200,removal_ack=false)=>api('/api/releases','POST',{op:'publish_development',id:d.id,intent_hash:p.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true,removal_ack},owner,status);
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

 await api('/api/tables','POST',{name:'rename_rows',label:'Rename rows',columns:[{name:'original',label:'Original',type:'text'},{name:'unused',label:'Unused',type:'text'}]});
 const renamedRow=await api('/api/data/rename_rows','POST',{original:'keep me'});
 const rename=await api('/api/releases','POST',{op:'create',label:'Rename only',mode:'development'});
 await api('/api/tables/rename_rows','PATCH',{op:'rename_column',name:'original',new_name:'renamed'},owner+'; nocode_draft='+rename.id);
 await rehearse(rename);
 const renameReady=await ready(rename);
 assert.equal(renameReady.eligible,true,JSON.stringify(renameReady));
 assert.equal((await publish(rename,renameReady)).status,'committed');
 assert.equal(native.prepare('SELECT renamed FROM t_rename_rows WHERE id=?').get(renamedRow.id).renamed,'keep me');

 const removal=await api('/api/releases','POST',{op:'create',label:'Remove empty column',mode:'development'});
 await api('/api/tables/rename_rows','PATCH',{op:'drop_column',name:'unused'},owner+'; nocode_draft='+removal.id);
 await rehearse(removal);
 const removalReady=await ready(removal);
 assert.equal(removalReady.eligible,true,JSON.stringify(removalReady));
 await api('/api/data/rename_rows?id='+renamedRow.id,'PUT',{unused:'new live value'});
 await publish(removal,removalReady,409,true);
 assert.equal(native.prepare('SELECT unused FROM t_rename_rows WHERE id=?').get(renamedRow.id).unused,'new live value');
 await rehearse(removal);
 const populatedColumn=await ready(removal);
 assert.equal(populatedColumn.removalImpact.find(item=>item.column==='unused').count,1);
 await publish(removal,populatedColumn,409);
 assert.equal((await publish(removal,populatedColumn,200,true)).status,'committed');
 assert.equal(native.pragma('table_info(t_rename_rows)').some(c=>c.name==='unused'),false);
 assert.equal(native.prepare('SELECT renamed FROM t_rename_rows WHERE id=?').get(renamedRow.id).renamed,'keep me');

 await api('/api/tables','POST',{name:'empty_remove',label:'Empty table',columns:[{name:'value',label:'Value',type:'text'}]});
 const drop=await api('/api/releases','POST',{op:'create',label:'Remove empty table',mode:'development'});
 await api('/api/tables/empty_remove','DELETE',undefined,owner+'; nocode_draft='+drop.id);
 await rehearse(drop);
 const dropReady=await ready(drop);
 assert.equal(dropReady.eligible,true,JSON.stringify(dropReady));
 const newRow=await api('/api/data/empty_remove','POST',{value:'Arrived after rehearsal'});
 await publish(drop,dropReady,409);
 assert.equal(native.prepare('SELECT value FROM t_empty_remove WHERE id=?').get(newRow.id).value,'Arrived after rehearsal');
 await rehearse(drop);
 const populatedTable=await ready(drop);
 assert.equal(populatedTable.removalImpact.find(item=>item.table==='empty_remove').count,1);
 await publish(drop,populatedTable,409);
 const dropped=await publish(drop,populatedTable,200,true);
 assert.equal(dropped.status,'committed');
 const removalBackup=new Database(path.join(path.dirname(dbPath),'backups',dropped.backup),{readonly:true});
 try{assert.equal(removalBackup.prepare('SELECT value FROM t_empty_remove WHERE id=?').get(newRow.id).value,'Arrived after rehearsal');}finally{removalBackup.close();}
 assert.equal(native.prepare("SELECT name FROM sqlite_schema WHERE name='t_empty_remove'").get(),undefined);

 await api('/api/tables','POST',{name:'phone_rewrite',label:'Phone rewrite',columns:[{name:'value',label:'Phone',type:'text'}]});
 const phone=await api('/api/data/phone_rewrite','POST',{value:'081-234-5678'});
 const rewrite=await api('/api/releases','POST',{op:'create',label:'Normalize phone',mode:'development'});
 await convert('phone_rewrite',owner+'; nocode_draft='+rewrite.id,{type:'phone'});
 await rehearse(rewrite);
 const rewriteReady=await ready(rewrite);
 assert.equal(rewriteReady.eligible,true,JSON.stringify(rewriteReady));
 assert.equal(native.prepare('SELECT value FROM t_phone_rewrite WHERE id=?').get(phone.id).value,'081-234-5678');
 assert.equal((await publish(rewrite,rewriteReady)).status,'committed');
 assert.equal(native.prepare('SELECT value FROM t_phone_rewrite WHERE id=?').get(phone.id).value,'0812345678');
 // Compatibility is checked against current live values before rebuilding storage.
 await api('/api/tables','POST',{name:'number_rewrite',label:'Number rewrite',columns:[{name:'value',label:'Value',type:'text',is_unique:true},{name:'note',label:'Note',type:'text'}]});
 const amount=await api('/api/data/number_rewrite','POST',{value:'12.5',note:'keep'});
 await api('/api/tables','POST',{name:'rewrite_key',columns:[{name:'value',type:'text',is_key:true}]});
 const keyed=await api('/api/data/rewrite_key','POST',{value:'7'});
 const storage=await api('/api/releases','POST',{op:'create',label:'Storage conversion',mode:'development'});
 await convert('number_rewrite',owner+'; nocode_draft='+storage.id,{type:'number'});
 await convert('rewrite_key',owner+'; nocode_draft='+storage.id,{type:'number'});
 await rehearse(storage);
 const prior=await ready(storage);
 const queue=new Database(path.join(path.dirname(dbPath),'.app-releases','rehearsal-jobs.db'));try{
  const job=queue.prepare('SELECT result_json FROM jobs WHERE id=?').get(prior.rehearsalId);
  queue.prepare('UPDATE jobs SET result_json=? WHERE id=?').run(JSON.stringify({...JSON.parse(job.result_json),expiresAt:Date.now()-1}),prior.rehearsalId);
 }finally{queue.close();}
 assert.equal((await ready(storage)).eligible,false);
 await publish(storage,prior,409);
 await rehearse(storage);
 const storageReady=await ready(storage);
 assert.equal(storageReady.eligible,true,JSON.stringify(storageReady));
 const invalid=await api('/api/data/number_rewrite','POST',{value:'abc'});
 const rejected=await publish(storage,storageReady,409);
 assert.ok(rejected.validation.reasons.some(reason=>reason.includes(String(invalid.id))));
 assert.equal(native.prepare('SELECT value FROM t_number_rewrite WHERE id=?').get(invalid.id).value,'abc');
 await api('/api/data/number_rewrite?id='+invalid.id,'PUT',{value:'2'});
 const duplicate=await api('/api/data/number_rewrite','POST',{value:'02'});
 const collision=await publish(storage,await ready(storage),409);
 assert.ok(collision.validation.reasons.some(reason=>reason.includes('Key / Unique')));
 assert.equal(native.prepare('SELECT value FROM t_number_rewrite WHERE id=?').get(duplicate.id).value,'02');
 await api('/api/data/number_rewrite?id='+duplicate.id,'PUT',{value:'3'});
 assert.equal((await publish(storage,await ready(storage))).status,'committed');
 assert.equal(native.prepare('SELECT value FROM t_rewrite_key WHERE id=?').get(keyed.id).value,7);
 assert.ok(native.pragma('index_list(t_rewrite_key)').some(index=>index.name==='_key_rewrite_key'&&index.unique));
 assert.ok(native.pragma('index_list(t_number_rewrite)').some(index=>index.name==='_unique_number_rewrite_value'&&index.unique));
 assert.equal(native.pragma('table_info(t_number_rewrite)').find(c=>c.name==='value').type,'REAL');
 assert.deepEqual(native.prepare('SELECT id,value,note FROM t_number_rewrite WHERE id=?').get(amount.id),{id:amount.id,value:12.5,note:'keep'});
 await api('/api/tables','POST',{name:'rewrite_child',label:'Child',columns:[{name:'value',label:'Parent',type:'ref',ref_table:'number_rewrite'}]});
 const child=await api('/api/data/rewrite_child','POST',{value:amount.id});
 await api('/api/tables','POST',{name:'rewrite_destination',label:'Destination',columns:[{name:'label',type:'text',is_key:true}]});
 await api('/api/data/rewrite_destination','POST',{label:'Different parent'});
 const destination=await api('/api/data/rewrite_destination','POST',{label:String(amount.id)});
 assert.notEqual(destination.id,amount.id);
 await api('/api/tables','POST',{name:'rewrite_retained',columns:[{name:'value',type:'ref',ref_table:'number_rewrite'}]});
 const retained=await api('/api/data/rewrite_retained','POST',{value:amount.id});
 const userId=native.prepare('SELECT id FROM _users WHERE active=1 ORDER BY id LIMIT 1').get().id;
 await api('/api/tables','POST',{name:'rewrite_user',columns:[{name:'value',type:'text'}]});
 const account=await api('/api/data/rewrite_user','POST',{value:String(userId)});
 await api('/api/tables','POST',{name:'rewrite_list',columns:[{name:'value',type:'list',ref_table:'number_rewrite'}]});
 const list=await api('/api/data/rewrite_list','POST',{value:[String(amount.id)]});
 const mediaId=require('node:crypto').randomUUID();
 native.prepare('INSERT INTO _files(id,name,mime,data) VALUES(?,?,?,?)').run(mediaId,'fixture.pdf','application/pdf',Buffer.from('%PDF-fixture'));
 native.prepare('INSERT INTO _images(id,mime,data) VALUES(?,?,?)').run(mediaId,'image/png',Buffer.from('image-fixture'));
 const media=[['file','/api/files/'+mediaId],['image','/api/images/'+mediaId],['signature','/api/images/'+mediaId]];
 for(const [type,value] of media){
  await api('/api/tables','POST',{name:'rewrite_'+type,columns:[{name:'value',type:'text'}]});
  await api('/api/data/rewrite_'+type,'POST',{value});
 }
 const linked=await api('/api/releases','POST',{op:'create',label:'Linked conversion',mode:'development'}),linkedCookie=owner+'; nocode_draft='+linked.id;
 await convert('number_rewrite',linkedCookie,{type:'text'});
 await convert('rewrite_child',linkedCookie,{type:'ref',ref_table:'rewrite_destination'},'key');
 await convert('rewrite_user',linkedCookie,{type:'user'});
 await convert('rewrite_list',linkedCookie,{type:'list',ref_table:'rewrite_destination'});
 for(const [type] of media)await convert('rewrite_'+type,linkedCookie,{type});
 await rehearse(linked);
 assert.equal((await publish(linked,await ready(linked))).status,'committed');
 assert.equal(native.prepare('SELECT value FROM t_rewrite_child WHERE id=?').get(child.id).value,destination.id);
 assert.equal(native.prepare('SELECT value FROM t_rewrite_retained WHERE id=?').get(retained.id).value,amount.id);
 assert.equal(native.pragma('foreign_key_list(t_rewrite_child)')[0].table,'t_rewrite_destination');
 assert.deepEqual(native.pragma('foreign_key_check'),[]);
 assert.equal(native.prepare('SELECT value FROM t_rewrite_user WHERE id=?').get(account.id).value,userId);
 assert.deepEqual(JSON.parse(native.prepare('SELECT value FROM t_rewrite_list WHERE id=?').get(list.id).value),[String(amount.id)]);
 for(const [type,value] of media){
  assert.equal(native.prepare('SELECT value FROM t_rewrite_'+type).get().value,value);
  assert.equal(native.prepare('SELECT type FROM _columns WHERE table_name=? AND name=?').get('rewrite_'+type,'value').type,type);
 }
 await api('/api/tables','POST',{name:'new_ref_source',columns:[{name:'value',type:'text'}]});
 const source=await api('/api/data/new_ref_source','POST',{value:'1'});
 const newRef=await api('/api/releases','POST',{op:'create',label:'Ref to new table',mode:'development'}),newRefCookie=owner+'; nocode_draft='+newRef.id;
 await api('/api/tables','POST',{name:'new_ref_target',columns:[{name:'title',type:'text'}]},newRefCookie);
 const newTarget=await api('/api/data/new_ref_target','POST',{title:'Seed target'},newRefCookie);
 assert.equal(newTarget.id,1);
 await convert('new_ref_source',newRefCookie,{type:'ref',ref_table:'new_ref_target'});
 await rehearse(newRef);
 const latestRef=await ready(newRef);assert.equal(latestRef.eligible,true,JSON.stringify(latestRef));
 assert.equal((await publish(newRef,latestRef)).status,'committed');
 assert.equal(native.prepare('SELECT value FROM t_new_ref_source WHERE id=?').get(source.id).value,newTarget.id);
 assert.equal(native.pragma('foreign_key_list(t_new_ref_source)')[0].table,'t_new_ref_target');
 assert.deepEqual(native.pragma('foreign_key_check'),[]);
 // Named-app metadata and publication workers use the same app boundary.
 const app=await api('/api/applications','POST',{label:'Type publication app'},owner,201),ac=owner+'; nocode_app='+app.id;
 await api('/api/tables','POST',{name:'named_type_rows',label:'Named type',columns:[{name:'value',type:'text'}]},ac);await api('/api/data/named_type_rows','POST',{value:'A'},ac);
 const nd=await api('/api/releases','POST',{op:'create',label:'Named type release',mode:'development'},ac);
 await convert('named_type_rows',ac+'; nocode_draft='+nd.id,{type:'enum',options:'A,B'});await rehearse(nd,ac);
 const np=await api('/api/releases?id='+nd.id+'&publication=1','GET',undefined,ac);assert.equal(np.eligible,true,JSON.stringify(np));
 await api('/api/releases','POST',{op:'publish_development',id:nd.id,intent_hash:np.intentHash,confirmation:'เผยแพร่โครงสร้าง',ack:true},ac);
 assert.equal(native.prepare("SELECT type FROM _columns WHERE table_name='named_type_rows' AND name='value'").get().type,'enum');
 assert.deepEqual(native.prepare('SELECT id,value FROM t_named_type_rows').all(),[{id:1,value:'A'}]);assert.deepEqual(native.prepare('SELECT * FROM t_type_rows ORDER BY id').all(),before);
 console.log('PASS column rename, safe column removal, and Text-to-Enum rehearsal/publication: empty and populated columns, unchanged rows/IDs/SQL, new invalid live row blocks commit, retry after correction, backup, idempotency, incompatible live values block storage conversion, Ref ID/Key and List retarget, inbound FK preservation, User and attachment conversion.');
 }finally{native.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
