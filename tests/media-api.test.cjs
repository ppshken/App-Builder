const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
async function api(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('Images stay in SQLite; date-time CRUD, invalid inputs, immutable types and column rebuild',async()=>{
 await api('/api/tables','POST',{name:'media_api',label:'รูปและเวลา',columns:[{name:'name',label:'ชื่อ',type:'text'},{name:'photo',label:'รูปภาพ',type:'image',required:true},{name:'at',label:'วัน–เวลา',type:'datetime',default_expr:'NOW()'},{name:'remove_me',label:'ลบ',type:'text'}]});
 const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'photo.png');const uploaded=await fetch(base+'/api/images',{method:'POST',body:form});assert.equal(uploaded.status,200);const {url}=await uploaded.json();
 const fetched=await fetch(base+url);assert.equal(fetched.headers.get('content-type'),'image/png');assert.equal(fetched.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await fetched.arrayBuffer()),png);
 const invalid=new FormData();invalid.append('file',new Blob(['<svg onload=alert(1)>'],{type:'image/png'}),'fake.png');assert.equal((await fetch(base+'/api/images',{method:'POST',body:invalid})).status,400);
 const oversized=new FormData();oversized.append('file',new Blob([Buffer.alloc(5*1024*1024+1)],{type:'image/png'}),'large.png');assert.equal((await fetch(base+'/api/images',{method:'POST',body:oversized})).status,413);
 const {id}=await api('/api/data/media_api','POST',{name:'ภาพทดสอบ',photo:url,at:'2026-10-05T07:30:00Z'});
 let row=(await api('/api/data/media_api?id='+id))[0];assert.equal(row.at,'2026-10-05T14:30:00.000+07:00');assert.equal(row.photo,url);
 await api('/api/data/media_api?id='+id,'PUT',{at:'2026-10-06T09:15'});await api('/api/data/media_api?id='+id,'PUT',{at:'2026-02-29T10:00'},400);
 await api('/api/data/media_api?id='+id,'PUT',{photo:'/api/images/00000000-0000-0000-0000-000000000000'},400);
 await api('/api/tables/media_api','PATCH',{op:'edit_column',name:'at',label:'วัน–เวลา',type:'text'},400);
 await api('/api/tables/media_api','PATCH',{op:'drop_column',name:'remove_me'});
 row=(await api('/api/data/media_api?id='+id))[0];assert.equal(row.at,'2026-10-06T09:15:00.000+07:00');assert.equal(row.photo,url);
 const db=new Database(process.env.NOCODE_TEST_DB,{readonly:true});assert.deepEqual(db.prepare('SELECT data FROM _images WHERE id=?').get(url.split('/').pop()).data,png);assert.deepEqual(db.pragma('foreign_key_check'),[]);db.close();
 await api('/api/data/media_api?id='+id,'PUT',{photo:null},400);await api('/api/tables/media_api','PATCH',{op:'edit_column',name:'photo',label:'รูปภาพ',type:'image',required:false});await api('/api/data/media_api?id='+id,'PUT',{photo:null});assert.equal((await api('/api/data/media_api?id='+id))[0].photo,null);
});
