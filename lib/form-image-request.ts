import {databaseGeneration} from './db';
import {readBody} from './api';
import {AuthError} from './auth';
import {FORM_IMAGE_TOKEN,MAX_FORM_IMAGE_BYTES,MAX_FORM_IMAGE_COUNT,MAX_FORM_JSON_BYTES,type FormImageDescriptor} from './form-image-protocol';
import type {FormImageUpload} from './form-images';

export async function readFormImageRequest(req:Request):Promise<{values:Record<string,any>;images:FormImageUpload[]}>{
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data'))return {values:await readBody(req),images:[]};
  const generation=databaseGeneration(),limit=MAX_FORM_IMAGE_BYTES+MAX_FORM_JSON_BYTES;
  if(Number(req.headers.get('content-length'))>limit)throw new AuthError('ข้อมูลฟอร์มและรูปภาพรวมกันมีขนาดใหญ่เกินกำหนด',413);
  const reader=req.body?.getReader();if(!reader)throw Error('ไม่พบข้อมูลฟอร์ม');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>limit){await reader.cancel();throw new AuthError('ข้อมูลฟอร์มและรูปภาพรวมกันมีขนาดใหญ่เกินกำหนด',413);}chunks.push(part.value);}
  const form=await new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array(Buffer.concat(chunks))}).formData();
  const raw=form.get('values'),manifest=form.get('images');
  if(typeof raw!=='string'||typeof manifest!=='string'||form.getAll('values').length!==1||form.getAll('images').length!==1||Buffer.byteLength(raw)+Buffer.byteLength(manifest)>MAX_FORM_JSON_BYTES)throw Error('ข้อมูลฟอร์มและรายการรูปไม่ถูกต้อง');
  let values:Record<string,any>,descriptors:FormImageDescriptor[];
  try{values=JSON.parse(raw);descriptors=JSON.parse(manifest);}catch{throw Error('ข้อมูลฟอร์มและรายการรูปต้องเป็น JSON');}
  if(!values||typeof values!=='object'||Array.isArray(values)||!Array.isArray(descriptors)||descriptors.length>MAX_FORM_IMAGE_COUNT)throw Error('ข้อมูลฟอร์มหรือจำนวนรูปไม่ถูกต้อง');
  const images:FormImageUpload[]=[],keys=new Set(['values','images']);let total=0;
  for(let i=0;i<descriptors.length;i++){const d=descriptors[i],key='file_'+i,file=form.get(key);keys.add(key);
    if(!d||typeof d.token!=='string'||!FORM_IMAGE_TOKEN.test(d.token)||typeof d.table!=='string'||typeof d.column!=='string'||!file||typeof file==='string'||form.getAll(key).length!==1)throw Error('รายการรูปที่แนบไม่ถูกต้อง');
    total+=file.size;if(total>MAX_FORM_IMAGE_BYTES)throw new AuthError('รูปทั้งหมดในฟอร์มรวมกันต้องไม่เกิน 50 MB',413);
    images.push({...d,originalName:file.name.slice(0,255),bytes:Buffer.from(await file.arrayBuffer())});
  }
  form.forEach((_value,key)=>{if(!keys.has(key))throw Error('มีไฟล์แนบที่ไม่อยู่ในรายการรูปของฟอร์ม');});
  if(generation!==databaseGeneration())throw new AuthError('ฐานข้อมูลถูกกู้คืนระหว่างบันทึก กรุณาโหลดหน้าใหม่',409);
  return {values,images};
}
