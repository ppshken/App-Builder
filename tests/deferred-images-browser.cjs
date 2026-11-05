const {chromium,expect:baseExpect}=require('@playwright/test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');
const expect=baseExpect.configure({timeout:25000}),base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(url,method='GET',body){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
(async()=>{
 await api('/api/tables','POST',{name:'photo_forms',label:'Photo forms',columns:[{name:'name',label:'Name',type:'text',required:true,is_label:true},{name:'photo',label:'Photo',type:'image',image_path:'forms/photos'}]});
 await api('/api/tables','POST',{name:'photo_children',label:'Children',columns:[{name:'parent',label:'Parent',type:'ref',ref_table:'photo_forms',is_part_of:true},{name:'name',label:'Child name',type:'text',required:true,is_label:true},{name:'photo',label:'Child photo',type:'image',image_path:'children/photos',is_label:true}]});
 await api('/api/settings','PUT',{image_storage:'database_copy',image_max_edge:640,image_format:'jpeg',image_quality:80});
 const db=new Database(process.env.NOCODE_TEST_DB,{readonly:true}),folder=path.dirname(process.env.NOCODE_TEST_DB),browser=await chromium.launch({channel:process.env.NOCODE_BROWSER_CHANNEL||'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')requests.push({url:new URL(r.url()).pathname,method:r.method(),type:r.headers()['content-type']||''});});
 const count=table=>db.prepare('SELECT COUNT(*) n FROM '+table).get().n,media=()=>count('_images'),files=()=>fs.existsSync(path.join(folder,'uploads'))?fs.readdirSync(path.join(folder,'uploads'),{recursive:true}).filter(p=>/\.(jpg|png|gif|webp)$/.test(p)).length:0;
 try{
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle='#2563eb';ctx.fillRect(0,0,1280,640);return c.toDataURL('image/png').split(',')[1];}),'base64');
  const image={name:'photo.png',mimeType:'image/png',buffer:png};
  await page.goto(base+'/t/photo_forms');
  const form=page.getByRole('dialog',{name:'เพิ่มข้อมูล',exact:true});
  const open=async name=>{await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).click();await form.getByLabel('Name *',{exact:true}).fill(name);};
  const select=async scope=>{await scope.locator('input[type=file]').setInputFiles(image);await expect(scope.locator('.image-field-preview')).toHaveAttribute('src',/^blob:/);await expect.poll(()=>scope.locator('.image-field-preview').evaluate(img=>img.complete&&img.naturalWidth===640&&img.naturalHeight===320)).toBe(true);};
  const discard=async scope=>{await scope.getByRole('button',{name:'ยกเลิก',exact:true}).click();await page.getByRole('dialog',{name:'ยังไม่ได้บันทึกข้อมูล',exact:true}).getByRole('button',{name:'ปิดโดยไม่บันทึก',exact:true}).click();};
  await open('Cancelled');await select(form);await select(form);assert.equal(media(),0);assert.equal(files(),0);assert.equal(count('t_photo_forms'),0);
  await form.getByRole('button',{name:'นำรูปภาพออก',exact:true}).click();await expect(form.locator('.image-field-preview')).toHaveCount(0);await select(form);await discard(form);assert.equal(media(),0);assert.equal(files(),0);
  await open('Saved');await select(form);await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form).toHaveCount(0);
  assert.equal(media(),1);assert.equal(files(),1);assert.equal(count('t_photo_forms'),1);let rows=await api('/api/data/photo_forms'),first=rows.find(r=>r.name==='Saved');assert.match(first.photo,/^\/api\/images\/[a-f0-9-]{36}$/);
  const savedImage=db.prepare('SELECT mime,storage_path FROM _images').get();assert.equal(savedImage.mime,'image/jpeg');assert.match(savedImage.storage_path,/^uploads\/forms\/photos\/.+\.jpg$/);
  await page.getByRole('button',{name:'แก้ไข Saved',exact:true}).click();const edit=page.getByRole('dialog',{name:'แก้ไขข้อมูล',exact:true});await select(edit);await discard(edit);assert.equal((await api('/api/data/photo_forms?id='+first.id))[0].photo,first.photo);assert.equal(media(),1);
  await open('Server failure');await select(form);
  await api('/api/tables/photo_forms','PATCH',{op:'edit_column',name:'name',valid_if:'[_THIS] <> "Server failure"'});
  await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Valid_If');
  assert.equal(media(),1);assert.equal(files(),1);assert.equal(count('t_photo_forms'),1);await expect(form.locator('.image-field-preview')).toHaveAttribute('src',/^blob:/);
  await form.getByLabel('Name *',{exact:true}).fill('Retried');await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form).toHaveCount(0);assert.equal(media(),2);assert.equal(files(),2);
  await open('Nested');await select(form);await form.getByRole('button',{name:'เพิ่มรายการลูก',exact:true}).click();
  const child=page.locator('.runtime-child-screen');await child.getByLabel('Child name *',{exact:true}).fill('Child');await select(child);await child.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(child).toHaveCount(0);
  assert.equal(media(),2);assert.equal(files(),2);assert.equal(count('t_photo_children'),0);await expect(form.locator('.part-of-records img[src^="blob:"]')).toBeVisible();
  await form.getByRole('button',{name:'แก้ไขรายการลูก Child',exact:true}).click();await select(child);await discard(child);await expect(child).toHaveCount(0);await expect(form.locator('.part-of-records img[src^="blob:"]')).toBeVisible();
  await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form).toHaveCount(0);assert.equal(media(),4);assert.equal(files(),4);assert.equal(count('t_photo_children'),1);
  const nested=(await api('/api/data/photo_forms')).find(r=>r.name==='Nested'),savedChild=(await api('/api/data/photo_children'))[0];assert.equal(savedChild.parent,nested.id);assert.match(savedChild.photo,/^\/api\/images\/[a-f0-9-]{36}$/);
  await page.setViewportSize({width:390,height:844});await open('Parent cancelled');await form.getByRole('button',{name:'เพิ่มรายการลูก',exact:true}).click();await child.getByLabel('Child name *',{exact:true}).fill('Unsaved child');await select(child);await child.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(child).toHaveCount(0);await discard(form);assert.equal(media(),4);assert.equal(files(),4);assert.equal(count('t_photo_children'),1);
  await open('Removed draft');await form.getByRole('button',{name:'เพิ่มรายการลูก',exact:true}).click();await child.getByLabel('Child name *',{exact:true}).fill('Removed child');await select(child);await child.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(child).toHaveCount(0);await form.getByRole('button',{name:'นำรายการลูกออก Removed child',exact:true}).click();await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form).toHaveCount(0);assert.equal(media(),4);assert.equal(files(),4);assert.equal(count('t_photo_children'),1);
  assert.equal(requests.filter(r=>r.url==='/api/images').length,0,'Selecting, replacing and cancelling photos must not upload them');
  assert.equal(requests.filter(r=>r.url==='/api/data/photo_forms'&&r.type.startsWith('multipart/form-data')).length,4,'Only save/retry requests carry photos');
  assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.deepEqual(errors,[]);
  await api('/api/tables/photo_forms','PATCH',{op:'edit_column',name:'photo',image_path:'CONCATENATE("inspection/", [id])'});
  await api('/api/tables/photo_children','PATCH',{op:'edit_column',name:'photo',image_path:'[parent]'});
  await page.reload();await open('Dynamic folders');await select(form);await form.getByRole('button',{name:'เพิ่มรายการลูก',exact:true}).click();await child.getByLabel('Child name *',{exact:true}).fill('Dynamic child');await select(child);await child.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(child).toHaveCount(0);await form.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await expect(form).toHaveCount(0);
  const dynamic=db.prepare("SELECT * FROM t_photo_forms WHERE name='Dynamic folders'").get(),dynamicChild=db.prepare("SELECT * FROM t_photo_children WHERE name='Dynamic child'").get();
  for(const [row,expected] of [[dynamic,'inspection/'+dynamic.id],[dynamicChild,String(dynamic.id)]]){const meta=db.prepare("SELECT folder,copy_path FROM _media_catalog WHERE id=?").get(row.photo.split('/').pop());assert.equal(meta.folder,expected);assert.ok(meta.copy_path.startsWith('uploads/'+expected+'/'));assert.ok(fs.existsSync(path.join(folder,meta.copy_path)));}
  const existingImage=db.prepare('SELECT storage_path FROM _images WHERE id=?').get(first.photo.split('/').pop());assert.equal(existingImage.storage_path,savedImage.storage_path,'Existing images must not move when the formula changes');
  assert.deepEqual(errors,[]);console.log('PASS Dynamic image folders: API configuration, mobile parent/child form save, generated IDs/Refs, catalog and disk paths, old-image retention');
  console.log('Deferred photos passed: zero image uploads on selection/replace/cancel, local resize, atomic multipart save, server failure and retry, child draft preview/edit/cancel, parent save/cancel, discarded children and mobile.');
 }catch(e){fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/deferred-images-failure.png',fullPage:true});console.error(await page.locator('body').innerText());throw e;}finally{db.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
