import {databaseGeneration} from "./db";
import { NextResponse } from "next/server";
export const bad = (error: string, status = 400, errors?:Record<string,string>) => NextResponse.json({ error, ...(errors?{errors}:{}) }, { status });
export function errorMessage(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  if (message.includes("FOREIGN KEY")) return "ข้อมูลนี้ถูกอ้างอิงอยู่ หรือไม่พบแถวที่เลือก กรุณาตรวจข้อมูลอ้างอิง";
  if (message.includes("UNIQUE")) return "ชื่อในระบบซ้ำ กรุณาใช้ชื่ออื่น";
  if (/[ก-๙]/.test(message)) return message;
  console.error(e);
  return "บันทึกข้อมูลไม่ได้ กรุณาตรวจข้อมูลที่กรอกและลองใหม่";
}
export async function readBody(req: Request): Promise<Record<string, any>> {
  const generation=databaseGeneration();
  let b: any;
  try {
    b = await req.json();
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
  } catch { throw new Error("รูปแบบข้อมูลไม่ถูกต้อง กรุณาส่งข้อมูลเป็น JSON object"); }
  if(generation!==databaseGeneration())throw new Error("ฐานข้อมูลถูกกู้คืนระหว่างทำรายการ กรุณาโหลดหน้าใหม่ก่อนบันทึก");
  return b;
}

export function errorStatus(e:unknown){const status=(e as {status?:number})?.status;return status&&[401,403,404,409,413,429,502,503,504].includes(status)?status:400;}
