import {imageFolder,iconImageUrl} from "./media-settings";
import { validateGlobalDisplayDefaults, type GlobalDisplayDefaults } from "./view-display";
import { ICON_CATALOG, type IconName } from "./icons";
export const APP_ICONS = ICON_CATALOG.map(i => i.name as IconName);
export const APP_COLORS = [
  { name: "blue", label: "น้ำเงิน", light: "#2563eb", dark: "#8eb4ff", soft: "#edf3ff", darkSoft: "#243553" },
  { name: "teal", label: "เขียวอมฟ้า", light: "#0f766e", dark: "#5eead4", soft: "#e6f7f4", darkSoft: "#173b38" },
  { name: "purple", label: "ม่วง", light: "#7c3aed", dark: "#c4b5fd", soft: "#f3edff", darkSoft: "#35254e" },
  { name: "rose", label: "ชมพู", light: "#be185d", dark: "#f9a8d4", soft: "#fff0f6", darkSoft: "#482338" },
  { name: "orange", label: "ส้ม", light: "#b45309", dark: "#fdba74", soft: "#fff5e8", darkSoft: "#442f1e" },
  { name: "slate", label: "เทา", light: "#475569", dark: "#cbd5e1", soft: "#f1f5f9", darkSoft: "#303b4d" },
] as const;
export const APP_FONTS = [
  {name:"sarabun",family:"Sarabun",description:"อ่านง่าย เหมาะกับข้อมูลและเอกสาร"},
  {name:"noto-sans-thai",family:"Noto Sans Thai",description:"เรียบ อ่านชัดบนทุกอุปกรณ์"},
  {name:"prompt",family:"Prompt",description:"ร่วมสมัย เหมาะกับหน้าจอแอป"},
  {name:"kanit",family:"Kanit",description:"ตัวอักษรเด่น ดูทันสมัย"},
  {name:"ibm-plex-sans-thai",family:"IBM Plex Sans Thai",description:"เรียบร้อย เหมาะกับงานธุรกิจ"},
  {name:"bai-jamjuree",family:"Bai Jamjuree",description:"สุภาพ เหมาะกับข้อความยาว"},
  {name:"chakra-petch",family:"Chakra Petch",description:"ทรงเหลี่ยม เหมาะกับงานเทคโนโลยี"},
  {name:"krub",family:"Krub",description:"นุ่มนวล อ่านสบาย"},
  {name:"mitr",family:"Mitr",description:"ตัวกลม เป็นกันเอง"},
  {name:"anuphan",family:"Anuphan",description:"เรียบและกระชับ"},
] as const;
export type AppSettings = { icon_image:string;home_view:string;image_max_edge:number;image_quality:number;image_format:"original"|"jpeg"|"webp";image_max_mb:number;image_storage:"database"|"database_copy";image_folder:string; name: string; icon: typeof APP_ICONS[number]; color: typeof APP_COLORS[number]["name"] | "custom"; mode: "auto" | "light" | "dark"; font: typeof APP_FONTS[number]["name"]; font_size: number; loading_style: "spinner" | "text" | "both"; loading_text: string; custom_color: string; display_defaults: GlobalDisplayDefaults };
export const DEFAULT_SETTINGS: AppSettings = {icon_image:"",home_view:"",image_max_edge:0,image_quality:85,image_format:"original",image_max_mb:5,image_storage:"database",image_folder:"images", name: "No-code Builder", icon: "grid", color: "blue", mode: "auto", font:"sarabun", font_size:14, loading_style:"text", loading_text:"กำลังโหลด…", custom_color:"#2563EB", display_defaults:{} };
export const fontFamily = (font: AppSettings["font"]) => `"${APP_FONTS.find(f=>f.name===font)?.family || "Sarabun"}", system-ui, sans-serif`;
export function normalizeHex(value: unknown) {
  if (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) throw new Error("โค้ดสีต้องเป็น # ตามด้วยตัวเลขหรือ A–F เช่น #2563EB หรือ #09F");
  const hex=value.trim().slice(1);return "#"+(hex.length===3?[...hex].map(c=>c+c).join(""):hex).toUpperCase();
}
export function validateSettings(b: Record<string,unknown>, previous: AppSettings): AppSettings {
  const value={...DEFAULT_SETTINGS,...previous,...b};
  if(typeof value.name!=="string" || !value.name.trim() || value.name.trim().length>100) throw new Error("ชื่อแอปต้องมี 1–100 ตัวอักษร");
  if(!APP_ICONS.some(icon=>icon===value.icon)) throw new Error("กรุณาเลือกไอคอนจากรายการ");
  if(value.color!=="custom" && !APP_COLORS.some(c=>c.name===value.color)) throw new Error("กรุณาเลือกสีจากรายการหรือกำหนดโค้ดสีเอง");
  if(!["auto","light","dark"].includes(value.mode as string)) throw new Error("กรุณาเลือกโหมดสว่าง มืด หรือตามอุปกรณ์");
  if(!APP_FONTS.some(f=>f.name===value.font)) throw new Error("กรุณาเลือกฟอนต์จากรายการ Google Fonts");
  if(!Number.isInteger(value.font_size) || (value.font_size as number)<12 || (value.font_size as number)>24) throw new Error("ขนาดตัวอักษรต้องเป็นจำนวนเต็ม 12–24 พิกเซล");
  if(!["spinner","text","both"].includes(value.loading_style as string)) throw new Error("กรุณาเลือกรูปแบบกำลังโหลดจากรายการ");
  if(typeof value.loading_text!=="string" || !value.loading_text.trim() || value.loading_text.trim().length>80) throw new Error("ข้อความกำลังโหลดต้องมี 1–80 ตัวอักษร");
  const icon_image=iconImageUrl(value.icon_image),image_folder=imageFolder(value.image_folder,false);if(typeof value.home_view!=="string"||value.home_view&&!/^[a-z][a-z0-9_]{0,40}$/.test(value.home_view))throw Error("กรุณาเลือกหน้าแรกที่มีอยู่");if(![0,640,1280,1920,2560].includes(value.image_max_edge as number))throw Error("ขนาดรูปต้องเป็นต้นฉบับ 640 1280 1920 หรือ 2560 พิกเซล");if(!Number.isInteger(value.image_quality)||Number(value.image_quality)<40||Number(value.image_quality)>100)throw Error("คุณภาพรูปต้องเป็น 40–100");if(!["original","jpeg","webp"].includes(value.image_format as string))throw Error("เลือกรูปแบบไฟล์ต้นฉบับ JPEG หรือ WebP");if(![0.5,1,2,5].includes(value.image_max_mb as number))throw Error("ขนาดไฟล์สูงสุดต้องเป็น 0.5 1 2 หรือ 5 MB");if(!["database","database_copy"].includes(value.image_storage as string))throw Error("เลือกรูปแบบการเก็บรูปภาพ");
  return {...value,icon_image,image_folder,name:value.name.trim(),loading_text:value.loading_text.trim(),custom_color:normalizeHex(value.custom_color),display_defaults:validateGlobalDisplayDefaults(value.display_defaults)} as AppSettings;
}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=(hex:string)=>rgb(hex).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
export const contrastRatio=(a:string,b:string)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const blend=(a:string,b:string,t:number)=>"#"+rgb(a).map((v,i)=>Math.round(v*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,"0")).join("");
export function themeColors(settings:AppSettings,dark:boolean){
  const preset=APP_COLORS.find(c=>c.name===settings.color)||APP_COLORS[0], button=settings.color==="custom"?normalizeHex(settings.custom_color):dark?preset.dark:preset.light;
  const buttonText=contrastRatio(button,"#FFFFFF")>=contrastRatio(button,"#111720")?"#FFFFFF":"#111720";
  let accent=button;const panel=dark?"#1b2330":"#ffffff";
  if(settings.color==="custom")for(let i=1;contrastRatio(accent,panel)<4.5&&i<=20;i++)accent=blend(button,dark?"#ffffff":"#000000",i/20);
  return {button,buttonText,accent,soft:settings.color==="custom"?blend(panel,button,dark?.2:.1):dark?preset.darkSoft:preset.soft};
}
