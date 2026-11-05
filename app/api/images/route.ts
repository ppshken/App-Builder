import {resolveImageFolder,imagePathIsExpression} from "@/lib/media-settings";
import {expressionContext} from "@/lib/expression-context";
import {refTablesOf} from "@/lib/columns";
import {recordMediaLocation} from '@/lib/media-location';
import {currentApplication} from '@/lib/application-context';
import {readAppSettings} from "@/lib/settings-server";
import {copyImageFile} from "@/lib/image-files";
import {columnsOf,tableExists,databasePath} from "@/lib/db";
import {assertTablePermission,currentAccess} from "@/lib/permissions";
import {AuthError,requestUser} from "@/lib/auth";
import {errorStatus} from "@/lib/api";
import {currentUser} from "@/lib/permissions";
import {withAuth} from "@/lib/auth-api";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db, databaseGeneration } from "@/lib/db";
import { bad, errorMessage } from "@/lib/api";
import { imageMime, imageDimensions, MAX_IMAGE_BYTES } from "@/lib/images";
export const dynamic = "force-dynamic";
async function handlePOST(req: Request) {
  try {
    const settings=readAppSettings();
    const generation=databaseGeneration();
    if (Number(req.headers.get("content-length")) > MAX_IMAGE_BYTES + 64 * 1024) return bad("รูปภาพต้องมีขนาดไม่เกิน 5 MB", 413);
    const reader=req.body?.getReader();if(!reader)throw Error('กรุณาเลือกรูปภาพ');const chunks:Uint8Array[]=[];let total=0;while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>MAX_IMAGE_BYTES+64*1024){await reader.cancel();return bad('รูปภาพต้องมีขนาดไม่เกิน 5 MB',413);}chunks.push(part.value);}const body=Buffer.concat(chunks);const form=await new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array(body)}).formData(),file=form.get('file');
    if (!file || typeof file === "string" || !file.size) return bad("กรุณาเลือกรูปภาพ");
    if (file.size > MAX_IMAGE_BYTES) return bad("รูปภาพต้องมีขนาดไม่เกิน 5 MB", 413);
    const signature=form.get('purpose')==='signature';const icon=form.get('purpose')==='app_icon';if(icon&&!currentAccess().builder)throw new AuthError('ผู้แก้ไขแอปเท่านั้นที่อัปโหลดไอคอนได้',403);const table=form.get('table'),column=form.get('column');let folder=settings.image_folder;
    if(signature&&(table===null||column===null))throw Error('กรุณาเลือกคอลัมน์ลายเซ็นที่มีอยู่');
    if(table!==null||column!==null){if(typeof table!=='string'||typeof column!=='string'||!tableExists(table))throw Error('ตารางรูปภาพไม่ถูกต้อง');assertTablePermission(table,'read');if(!currentAccess().builder&&!currentAccess().tables[table]?.create&&!currentAccess().tables[table]?.update)throw new AuthError('ไม่มีสิทธิ์อัปโหลดรูปของตารางนี้',403);const c=columnsOf(table).find(c=>c.name===column&&c.type===(signature?'signature':'image')&&!c.is_virtual);if(!c)throw Error('เลือกคอลัมน์รูปภาพที่มีอยู่');if(c.image_path){let row:Record<string,any>={};if(imagePathIsExpression(c.image_path)){const values=form.get('values');if(typeof values!=='string'||values.length>32000)throw Error('สูตรโฟลเดอร์รูปภาพต้องมีข้อมูลแถว กรุณาบันทึกผ่านฟอร์ม');row=JSON.parse(values);if(!row||typeof row!=='object'||Array.isArray(row))throw Error('ข้อมูลแถวสำหรับโฟลเดอร์รูปภาพไม่ถูกต้อง');}const now=new Date(),email=currentUser()?.email||'';folder=resolveImageFolder(c.image_path,settings.image_folder,row,{...expressionContext(now,email),now,userEmail:email,tableName:table,refTables:refTablesOf(columnsOf(table))});}}
    if(!icon&&!signature&&file.size>settings.image_max_mb*1024*1024)return bad('รูปภาพต้องมีขนาดไม่เกิน '+settings.image_max_mb+' MB',413);
    const bytes = Buffer.from(await file.arrayBuffer()), mime = imageMime(bytes);
    if(generation!==databaseGeneration())return bad("ฐานข้อมูลถูกกู้คืนระหว่างอัปโหลด กรุณาโหลดหน้าใหม่และเลือกรูปอีกครั้ง");
    if(signature&&mime!=='image/png')throw Error('ลายเซ็นต้องเป็น PNG');
    if (!mime) return bad("เลือกรูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น");
    if(!icon&&!signature&&settings.image_format!=='original'&&mime!==(settings.image_format==='jpeg'?'image/jpeg':'image/webp'))throw Error('รูปไม่ตรงรูปแบบที่กำหนด กรุณาอัปโหลดผ่านฟอร์มเพื่อแปลงไฟล์');
    const dimensions=imageDimensions(bytes,mime);if(icon&&(!dimensions||dimensions.width!==dimensions.height||dimensions.width!==512))throw Error('ไอคอนที่อัปโหลดต้องเป็นรูปสี่เหลี่ยมจัตุรัส 512 × 512 พิกเซล');if(!icon&&!signature&&settings.image_max_edge>0&&(!dimensions||Math.max(dimensions.width,dimensions.height)>settings.image_max_edge))throw Error('รูปภาพต้องมีด้านยาวไม่เกิน '+settings.image_max_edge+' พิกเซล กรุณาเลือกผ่านฟอร์มเพื่อปรับขนาด');if(dimensions&&dimensions.width*dimensions.height>40000000)throw Error('รูปภาพมีจำนวนพิกเซลมากเกินไป');if(!requestUser(req))throw new AuthError('Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',401);
    const id = randomUUID();let copy:ReturnType<typeof copyImageFile>|undefined;try{if(!icon&&!signature&&settings.image_storage==='database_copy')copy=copyImageFile(databasePath,folder,id,mime,bytes);
    db.transaction(()=>{db.prepare("INSERT INTO _images(id,mime,data,storage_path) VALUES(?,?,?,?)").run(id,mime,bytes,copy?.relative||"");const user=currentUser();if(user)db.prepare("INSERT INTO _image_uploads VALUES(?,?)").run(id,user.id);db.prepare('INSERT INTO _media_catalog(kind,id,app_id,user_id,created_at) VALUES(?,?,?,?,?)').run('image',id,currentApplication()?.id||'default',currentUser()!.id,Date.now());recordMediaLocation(db,'image',id,folder||'',file.name,copy?.relative||'');})();
    }catch(error){copy?.discard();throw error;}
    return NextResponse.json({ path:copy?.relative||"",url: `/api/images/${id}` });
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const POST = withAuth(handlePOST);
