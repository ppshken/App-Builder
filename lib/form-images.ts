import {randomUUID} from 'node:crypto';
import {db,columnsOf,tableExists,databasePath,platformDatabase} from './db';
import {saveFormRecord} from './form-save';
import {assertIdentifier} from './columns';
import {assertTablePermission,currentUser} from './permissions';
import {currentApplication} from './application-context';
import {AuthError} from './auth';
import {readAppSettings} from './settings-server';
import {imageMime,imageDimensions,MAX_IMAGE_BYTES} from './images';
import {copyImageFile} from './image-files';
import {mediaReferences} from './media-inventory';
import {FORM_IMAGE_TOKEN,MAX_FORM_IMAGE_BYTES,MAX_FORM_IMAGE_COUNT,type FormImageDescriptor} from './form-image-protocol';

export type FormImageUpload=FormImageDescriptor&{bytes:Buffer};
export function saveFormWithImages(table:string,values:Record<string,any>,id:number|undefined,view:string|null,email:string,images:FormImageUpload[],storagePath=databasePath){
  if(!images.length)return saveFormRecord(table,values,id,view,email);
  const user=currentUser();if(!user)throw new AuthError('กรุณาเข้าสู่ระบบก่อนบันทึกรูป',401);
  if(images.length>MAX_FORM_IMAGE_COUNT||images.reduce((sum,image)=>sum+image.bytes.length,0)>MAX_FORM_IMAGE_BYTES)throw new AuthError('รูปทั้งหมดในฟอร์มต้องไม่เกิน 200 รูป และรวมกันไม่เกิน 50 MB',413);
  const settings=readAppSettings(),placements=new Map<string,{table:string;column:string}[]>(),seen=new Set<string>();
  let records=0;
  function inspect(name:string,body:Record<string,any>,rowId:number|undefined,depth=0){
    assertIdentifier(name);if(!tableExists(name))throw Error('ไม่พบตารางรูปภาพ');
    assertTablePermission(name,'read');assertTablePermission(name,rowId?'update':'create');
    if(depth>8||++records>201)throw Error('รายการลูกหรือรูปภาพซ้อนกันมากเกินไป');
    const cols=columnsOf(name);
    for(const c of cols.filter(c=>c.type==='image'&&!c.is_virtual))if(typeof body[c.name]==='string'){const list=placements.get(body[c.name])||[];list.push({table:name,column:c.name});placements.set(body[c.name],list);}
    if(body.__children===undefined)return;
    if(!Array.isArray(body.__children)||body.__children.length>20)throw Error('รูปแบบรายการลูกไม่ถูกต้อง');
    for(const group of body.__children){
      if(!group||typeof group!=='object'||!Array.isArray(group.records)||group.records.length>200)throw Error('รูปแบบรายการลูกไม่ถูกต้อง');
      assertIdentifier(group.table);assertIdentifier(group.column);
      const link=columnsOf(group.table).find(c=>c.name===group.column&&c.type==='ref'&&!c.is_virtual&&(c.is_part_of||c.related_required)&&c.ref_table===name);
      if(!link)throw Error('รูปต้องอยู่ในรายการลูกของฟอร์มนี้');
      for(const record of group.records){if(!record||!record.values||typeof record.values!=='object'||Array.isArray(record.values))throw Error('รูปแบบรายการลูกไม่ถูกต้อง');if(!record.deleted)inspect(group.table,record.values,record.id,depth+1);}
    }
  }
  inspect(table,values,id);
  const prepared=images.map(image=>{
    if(!FORM_IMAGE_TOKEN.test(image.token)||seen.has(image.token))throw Error('รหัสรูปในฟอร์มไม่ถูกต้องหรือซ้ำ');seen.add(image.token);
    assertIdentifier(image.table);assertIdentifier(image.column);
    if(!placements.get(image.token)?.some(p=>p.table===image.table&&p.column===image.column))throw Error('รูปที่แนบไม่ได้ถูกใช้ในคอลัมน์รูปของฟอร์มนี้');
    const column=columnsOf(image.table).find(c=>c.name===image.column&&c.type==='image'&&!c.is_virtual)!;
    if(!image.bytes.length||image.bytes.length>Math.min(MAX_IMAGE_BYTES,settings.image_max_mb*1024*1024))throw Error('รูปภาพต้องมีขนาดไม่เกิน '+settings.image_max_mb+' MB');
    const mime=imageMime(image.bytes);if(!mime)throw Error('เลือกรูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น');
    if(settings.image_format!=='original'&&mime!==(settings.image_format==='jpeg'?'image/jpeg':'image/webp'))throw Error('รูปไม่ตรงรูปแบบที่กำหนด กรุณาเลือกผ่านฟอร์มเพื่อแปลงไฟล์');
    const dimensions=imageDimensions(image.bytes,mime);
    if(dimensions&&dimensions.width*dimensions.height>40000000)throw Error('รูปภาพมีจำนวนพิกเซลมากเกินไป');
    if(settings.image_max_edge>0&&(!dimensions||Math.max(dimensions.width,dimensions.height)>settings.image_max_edge))throw Error('รูปภาพมีด้านยาวเกิน '+settings.image_max_edge+' พิกเซล กรุณาเลือกผ่านฟอร์มเพื่อปรับขนาด');
    return {...image,mime,id:randomUUID(),folder:column.image_path||settings.image_folder};
  });
  const mapping=Object.fromEntries(prepared.map(image=>[image.token,'/api/images/'+image.id]));
  const copies=new Map<string,ReturnType<typeof copyImageFile>>(),unused=new Set<string>();
  const discard=(copy:ReturnType<typeof copyImageFile>)=>{try{copy.discard();}catch{console.error('Could not remove an unused form image copy');}};
  function replace(value:any):any{if(typeof value==='string')return mapping[value]||value;if(Array.isArray(value))return value.map(replace);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='__display').map(([key,item])=>[key,replace(item)]));return value;}
  try{const result=db.transaction(()=>{
    for(const image of prepared){
      db.prepare('INSERT INTO _images(id,mime,data,storage_path) VALUES(?,?,?,?)').run(image.id,image.mime,image.bytes,'');
      db.prepare('INSERT INTO _image_uploads(image_id,user_id) VALUES(?,?)').run(image.id,user.id);
      db.prepare('INSERT INTO _media_catalog(kind,id,app_id,user_id,created_at) VALUES(?,?,?,?,?)').run('image',image.id,currentApplication()?.id||'default',user.id,Date.now());
    }
    const saved=saveFormRecord(table,replace(values),id,view,email);
    // A form-saved Action may remove or replace the image. Only discard a newly
    // received file after checking all references, including other applications.
    let references:ReturnType<typeof mediaReferences>|undefined;
    for(const image of prepared){const used=placements.get(image.token)!.some(p=>db.prepare('SELECT 1 FROM "t_'+p.table+'" WHERE "'+p.column+'"=? LIMIT 1').get(mapping[image.token]));
      if(!used){references??=mediaReferences(platformDatabase());if(!references.has('image:'+image.id)){unused.add(image.id);db.prepare('DELETE FROM _image_uploads WHERE image_id=?').run(image.id);db.prepare('DELETE FROM _media_catalog WHERE kind=\'image\' AND id=?').run(image.id);db.prepare('DELETE FROM _images WHERE id=?').run(image.id);}}
    }
    // Filesystem copies are created only after all row/child validation and
    // form-saved Actions succeed; any copy failure still rolls back the DB.
    if(settings.image_storage==='database_copy')for(const image of prepared)if(!unused.has(image.id)){
      const copy=copyImageFile(storagePath,image.folder,image.id,image.mime,image.bytes);copies.set(image.id,copy);
      db.prepare('UPDATE _images SET storage_path=? WHERE id=?').run(copy.relative,image.id);
    }
    return {...saved,image_urls:mapping};
  }).immediate();
    return result;
  }catch(error){for(const copy of copies.values())discard(copy);throw error;}
}
