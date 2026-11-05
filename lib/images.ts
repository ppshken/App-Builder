import {isRemoteImageSource} from "./image-source";
import {assertImageAccess} from "./permissions";
import { db } from "./db";
import type { Column } from "./columns";
export function checkImages(cols: Column[], row: Record<string, unknown>) {
  for (const c of cols.filter(c => ["image","signature"].includes(c.type) && !c.is_virtual)) {
    const value = row[c.name];
    if(c.type==='image'&&isRemoteImageSource(value))continue;
    if(typeof value==="string"&&value)assertImageAccess(value.slice("/api/images/".length));
    if (typeof value === "string" && value && !db.prepare("SELECT 1 FROM _images WHERE id=?").get(value.slice("/api/images/".length)))
      throw new Error(`ไม่พบรูปภาพของ "${c.label}" กรุณาเลือกรูปภาพอีกครั้ง`);
  }
}
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function imageMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export function imageDimensions(bytes:Buffer,mime:string):{width:number;height:number}|null{try{if(mime==='image/png'&&bytes.length>=24)return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};if(mime==='image/gif'&&bytes.length>=10)return {width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};if(mime==='image/webp'){const tag=bytes.toString('ascii',12,16);if(tag==='VP8X'&&bytes.length>=30)return {width:bytes.readUIntLE(24,3)+1,height:bytes.readUIntLE(27,3)+1};if(tag==='VP8L'&&bytes.length>=25){const bits=bytes.readUInt32LE(21);return {width:(bits&16383)+1,height:((bits>>>14)&16383)+1};}if(tag==='VP8 '&&bytes.length>=30)return {width:bytes.readUInt16LE(26)&16383,height:bytes.readUInt16LE(28)&16383};}if(mime==='image/jpeg'){let offset=2;while(offset+9<bytes.length){if(bytes[offset++]!==255)continue;let marker=bytes[offset++];while(marker===255)marker=bytes[offset++];if(marker===0xd9||marker===0xda)break;if(marker===0x01||marker>=0xd0&&marker<=0xd8)continue;const size=bytes.readUInt16BE(offset);if(size<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};offset+=size;}}}catch{}return null;}
