import {assertImageAccess} from '@/lib/permissions';
import {imageDimensions} from "@/lib/images";
import {readAppSettings} from "@/lib/settings-server";
import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSettings, AppSettings } from "@/lib/app-settings";
import { bad, errorMessage, readBody } from "@/lib/api";
export const dynamic = "force-dynamic";
function readSettings(): AppSettings {return readAppSettings();}
async function handleGET() { try { return NextResponse.json(readSettings()); } catch(e) { return bad(errorMessage(e),errorStatus(e)); } }
async function handlePUT(req: Request) { try {
  const b = await readBody(req);
  const previous = readSettings();
  const v = validateSettings(b, previous);
  for(const path of [v.icon_image,v.header.app_image])if(path.startsWith('/api/images/')&&path!==previous.icon_image&&path!==previous.header.app_image)assertImageAccess(path.slice(12));
  if(v.header.notifications_view&&!db.prepare("SELECT 1 FROM _views WHERE name=? AND position IN ('primary','menu') AND kind NOT IN ('detail','form')").get(v.header.notifications_view))throw Error("หน้าแจ้งเตือนต้องเป็น View หลักหรือเมนูที่มีอยู่");
  if(v.header.profile_setting&&!db.prepare("SELECT 1 FROM _user_setting_defs WHERE name=? AND type='text'").get(v.header.profile_setting))throw Error("แหล่งรูปโปรไฟล์ต้องเป็นค่าตั้งค่าผู้ใช้ชนิดข้อความที่มีอยู่");
  if(v.header.app_image.startsWith('/api/images/')&&!db.prepare("SELECT 1 FROM _images WHERE id=?").get(v.header.app_image.slice(12)))throw Error("ไม่พบรูป Header กรุณาอัปโหลดใหม่");
  if(v.navigation.featured_view&&!db.prepare("SELECT 1 FROM _views WHERE name=? AND position='primary'").get(v.navigation.featured_view))throw Error("เมนูเด่นต้องเป็น View ตำแหน่ง Primary ที่มีอยู่");
  if(v.home_view&&!db.prepare("SELECT 1 FROM _views WHERE name=? AND position IN ('primary','menu') AND kind NOT IN ('detail','form')").get(v.home_view))throw Error("หน้าแรกต้องเป็น View หลักหรือเมนูที่มีอยู่ และไม่ใช่ฟอร์มหรือรายละเอียด");
  if(v.icon_image.startsWith('/api/images/')&&!db.prepare("SELECT 1 FROM _images WHERE id=?").get(v.icon_image.slice(12)))throw Error("ไม่พบรูปไอคอน กรุณาอัปโหลดใหม่");
  if(v.icon_image.startsWith('/api/images/')){const image=db.prepare("SELECT mime,data FROM _images WHERE id=?").get(v.icon_image.slice(12)) as {mime:string;data:Buffer};const size=imageDimensions(image.data,image.mime);if(!size||size.width!==512||size.height!==512)throw Error("รูปไอคอนต้องเป็น 512 × 512 พิกเซล กรุณาอัปโหลดผ่านช่องไอคอนแอพ");}
  db.prepare("UPDATE _app_settings SET name=?,icon=?,color=?,mode=?,font=?,font_weight=?,font_size=?,loading_style=?,loading_text=?,custom_color=?,display_defaults_json=?,icon_image=?,home_view=?,image_max_edge=?,image_quality=?,image_format=?,image_max_mb=?,image_storage=?,image_folder=?,navigation_json=?,header_json=?,image_allow_gallery=? WHERE id=1").run(v.name,v.icon,v.color,v.mode,v.font,v.font_weight,v.font_size,v.loading_style,v.loading_text,v.custom_color,JSON.stringify(v.display_defaults),v.icon_image,v.home_view,v.image_max_edge,v.image_quality,v.image_format,v.image_max_mb,v.image_storage,v.image_folder,JSON.stringify(v.navigation),JSON.stringify(v.header),v.image_allow_gallery?1:0);
  return NextResponse.json({ok:true});
} catch(e) { return bad(errorMessage(e),errorStatus(e)); } }

export const GET = withAuth(handleGET);
export const PUT = withAuth(handlePUT);
