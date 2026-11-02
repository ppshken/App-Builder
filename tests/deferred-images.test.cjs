const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createPendingImages,submitFormWithImages}=require('../.test-build/pending-images');
const {saveFormWithImages}=require('../.test-build/form-images');
const {readFormImageRequest}=require('../.test-build/form-image-request');
const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{runAuthorized,accessFor}=require('../.test-build/permissions');
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB7sAAAAASUVORK5CYII=','base64');
const token=n=>'/api/images/00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function localStore(){let next=0;const revoked=[];return {revoked,store:createPendingImages({createObjectURL:()=>`blob:local-${++next}`,revokeObjectURL:url=>revoked.push(url)})};}
test('images remain local and child drafts retain previews until the owning parent discards them',async()=>{
 const {store,revoked}=localStore(),file=new File([bytes],'image.png',{type:'image/png'});
 const first=store.add('photos','photo',file),second=store.add('photos','photo',file);
 store.setFrame('parent',{form:{photo:second}});await Promise.resolve();
 assert.deepEqual(revoked,['blob:local-1']);assert.equal(store.preview(second),'blob:local-2');
 store.setFrame('child',{form:{photo:second}});store.setFrame('parent',{form:{__children:[{table:'photos',records:[{key:'new',values:{photo:second}}]}]}});store.removeFrame('child');await Promise.resolve();
 assert.equal(store.isLocal(second),true);
 store.setFrame('parent',{form:null});await Promise.resolve();assert.equal(store.isLocal(second),false);assert.deepEqual(revoked,['blob:local-1','blob:local-2']);
 store.dispose();assert.throws(()=>store.add('photos','photo',file),/ปิดแล้ว/);
});
test('form packaging sends only live photos and commits server URLs without losing retries or metadata versions',async()=>{
 const {store,revoked}=localStore(),file=new File([bytes],'image.png',{type:'image/png'}),photo=store.add('photos','photo',file),removed=store.add('photos','photo',file);
 const body={name:'Parent',__version:'keep',__children:[{table:'photos',column:'parent',records:[{key:'one',values:{photo,__display:{photo}}},{key:'removed',id:1,deleted:true,values:{photo:removed,__version:'old'}}]}]};
 const packaged=store.prepare(body);assert.equal(packaged.images.length,1);assert.equal(packaged.images[0].token,photo);assert.equal(packaged.values.__version,'keep');assert.equal(packaged.values.__children[0].records[0].values.__display,undefined);
 const oldFetch=global.fetch,requests=[];global.fetch=async(url,init)=>{requests.push(init);return new Response(JSON.stringify({error:'validation failed'}),{status:400});};
 try{const failed=await submitFormWithImages('/api/data/photos','POST',body,{'Content-Type':'application/json'},store);assert.equal(failed.status,400);assert.equal(store.isLocal(photo),true);assert.ok(requests[0].body instanceof FormData);assert.equal(new Headers(requests[0].headers).has('Content-Type'),false);
  global.fetch=async()=>new Response(JSON.stringify({id:1,image_urls:{[photo]:token(9)}}),{status:200});await submitFormWithImages('/api/data/photos','POST',body,{},store);
  assert.equal(store.preview(photo),token(9));assert.equal(store.isLocal(photo),false);assert.ok(revoked.includes('blob:local-1'));assert.equal(store.prepare({photo}).images.length,0);assert.equal(store.prepare({photo}).values.photo,token(9));
 }finally{global.fetch=oldFetch;store.dispose();}
});
function fixture(work){const database=new Database(':memory:'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'form-images-'));try{initializeDatabase(database,':memory:');database.exec(`
 INSERT INTO _users(id,name,email,password_hash,role,active,created_at,username,nickname,department) VALUES(1,'Owner','owner@example.test','synthetic','owner',1,1,'owner','Owner','QA');
 INSERT INTO _tables(name,label) VALUES('photos','Photos'),('children','Children');
 INSERT INTO _columns(table_name,name,label,type,required,is_part_of,ref_table) VALUES
 ('photos','name','Name','text',1,0,NULL),('photos','photo','Photo','image',0,0,NULL),
 ('children','parent','Parent','ref',1,1,'photos'),('children','name','Child name','text',1,0,NULL),('children','photo','Child photo','image',0,0,NULL);
 CREATE TABLE t_photos(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,photo TEXT);
 CREATE TABLE t_children(id INTEGER PRIMARY KEY AUTOINCREMENT,parent INTEGER REFERENCES t_photos(id),name TEXT,photo TEXT);
 UPDATE _app_settings SET image_storage='database_copy';`);
 const owner={id:1,name:'Owner',email:'owner@example.test',role:'owner'};
 return withDatabase(database,()=>runAuthorized(owner,accessFor(owner),()=>work(database,folder)));
 }finally{database.close();fs.rmSync(folder,{recursive:true,force:true});}}
const upload=(n,table='photos')=>({token:token(n),table,column:'photo',bytes});
const files=folder=>fs.existsSync(path.join(folder,'uploads','images'))?fs.readdirSync(path.join(folder,'uploads','images')):[];
test('a save commits photo, record, ownership and filesystem copy together; failure leaves none',()=>fixture((db,folder)=>{
 assert.throws(()=>saveFormWithImages('photos',{photo:token(1)},undefined,null,'',[upload(1)],path.join(folder,'data.db')),/Name/);
 for(const table of ['_images','_image_uploads','_media_catalog','t_photos'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.deepEqual(files(folder),[]);
 const result=saveFormWithImages('photos',{name:'Saved',photo:token(1)},undefined,null,'',[upload(1)],path.join(folder,'data.db'));
 const row=db.prepare('SELECT * FROM t_photos').get();assert.equal(row.photo,result.image_urls[token(1)]);assert.notEqual(row.photo,token(1));assert.equal(files(folder).length,1);
 assert.equal(db.prepare('SELECT user_id FROM _image_uploads').get().user_id,1);
 assert.throws(()=>saveFormWithImages('photos',{name:'Changed',photo:token(2),__version:'0'.repeat(64)},result.id,null,'',[upload(2)],path.join(folder,'data.db')),e=>e.status===409);
 assert.equal(db.prepare('SELECT photo FROM t_photos').get().photo,row.photo);assert.equal(db.prepare('SELECT COUNT(*) n FROM _images').get().n,1);assert.equal(files(folder).length,1);
}));
test('parent and child photos are atomic, including a failed child and a corrected retry',()=>fixture((db,folder)=>{
 const values={name:'Parent',photo:token(1),__children:[{table:'children',column:'parent',records:[{key:'new',values:{photo:token(2)}}]}]},images=[upload(1),upload(2,'children')];
 assert.throws(()=>saveFormWithImages('photos',values,undefined,null,'',images,path.join(folder,'data.db')),/Child name/);
 for(const table of ['t_photos','t_children','_images','_image_uploads','_media_catalog'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);assert.deepEqual(files(folder),[]);
 values.__children[0].records[0].values.name='Child';const result=saveFormWithImages('photos',values,undefined,null,'',images,path.join(folder,'data.db'));
 assert.equal(db.prepare('SELECT parent FROM t_children').get().parent,result.id);assert.equal(db.prepare('SELECT photo FROM t_children').get().photo,result.image_urls[token(2)]);assert.equal(files(folder).length,2);assert.deepEqual(db.pragma('foreign_key_check'),[]);
}));
test('unreferenced attachments, invalid bytes and denied child writes cannot create media',()=>fixture((db,folder)=>{
 assert.throws(()=>saveFormWithImages('photos',{name:'No photo'},undefined,null,'',[upload(1)],path.join(folder,'data.db')),/ไม่ได้ถูกใช้/);
 assert.throws(()=>saveFormWithImages('photos',{name:'Bad',photo:token(1)},undefined,null,'',[{...upload(1),bytes:Buffer.from('invalid')}],path.join(folder,'data.db')),/JPG/);
 const rights={read:true,create:true,update:true,delete:false},user={id:2,name:'Staff',email:'staff@example.test',role:'staff'};
 runAuthorized(user,{owner:false,builder:false,tables:{photos:rights,children:{...rights,create:false}},actions:[]},()=>assert.throws(()=>saveFormWithImages('photos',{name:'Parent',__children:[{table:'children',column:'parent',records:[{key:'new',values:{name:'Child',photo:token(2)}}]}]},undefined,null,'',[upload(2,'children')],path.join(folder,'data.db')),e=>e.status===403));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM _images').get().n,0);assert.deepEqual(files(folder),[]);
}));
test('a form-saved Action that clears a new photo leaves no unreferenced image or filesystem copy',()=>fixture((db,folder)=>{
 db.prepare("INSERT INTO _actions(name,label,table_name,kind,condition_expr,values_json) VALUES('clear_photo','Clear photo','photos','set','TRUE',?)").run(JSON.stringify({photo:'""'}));
 db.prepare("INSERT INTO _views(name,label,table_name,kind,position,display_json) VALUES('photo_form','Photo form','photos','form','ref',?)").run(JSON.stringify({form_saved_action:'clear_photo'}));
 saveFormWithImages('photos',{name:'Cleared',photo:token(1)},undefined,'photo_form','',[upload(1)],path.join(folder,'data.db'));
 assert.equal(db.prepare('SELECT photo FROM t_photos').get().photo,null);
 for(const table of ['_images','_image_uploads','_media_catalog'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.deepEqual(files(folder),[]);
}));
test('a partial filesystem write removes its own file and rolls back the record and media',()=>fixture((db,folder)=>{
 const original=fs.writeFileSync;
 fs.writeFileSync=(file,data,...args)=>{if(typeof file==='number'){original(file,Buffer.from('partial'));throw Error('synthetic disk error');}return original(file,data,...args);};
 try{assert.throws(()=>saveFormWithImages('photos',{name:'Failed copy',photo:token(1)},undefined,null,'',[upload(1)],path.join(folder,'data.db')),/disk error/);}
 finally{fs.writeFileSync=original;}
 for(const table of ['t_photos','_images','_image_uploads','_media_catalog'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.deepEqual(files(folder),[]);
}));
test('multipart parsing binds each file to its manifest and retains JSON compatibility',async()=>{
 const form=new FormData();form.append('values',JSON.stringify({name:'Image',photo:token(1)}));form.append('images',JSON.stringify([{token:token(1),table:'photos',column:'photo'}]));form.append('file_0',new Blob([bytes],{type:'image/png'}),'photo.png');
 const req=()=>new Request('http://localhost/api/data/photos',{method:'POST',body:form});
 const parsed=await readFormImageRequest(req());assert.equal(parsed.images.length,1);assert.deepEqual(parsed.images[0].bytes,bytes);
 form.append('unexpected',new Blob([bytes]));await assert.rejects(()=>readFormImageRequest(req()),/ไม่อยู่ในรายการ/);
 const json=await readFormImageRequest(new Request('http://localhost/api/data/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"Plain"}'}));assert.deepEqual(json,{values:{name:'Plain'},images:[]});
});
