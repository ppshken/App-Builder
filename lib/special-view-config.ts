import type {Column} from './columns';import type {ViewDisplay} from './view-display';
export const SPECIAL_COLUMN_KEYS=['map_location','map_image','map_lat','map_lng','map_title','chart_category','chart_value','calendar_start','calendar_end','calendar_title','calendar_color'] as const;
export function validateSpecialDisplay(d:ViewDisplay,cols:Column[]){
for(const key of SPECIAL_COLUMN_KEYS){const value=d[key];if(value!==undefined&&(typeof value!=='string'||value!==''&&value!=='id'&&!cols.some(c=>c.name===value)))throw Error('คอลัมน์ของแผนที่ กราฟ หรือปฏิทินไม่ถูกต้อง กรุณาเลือกจากตารางนี้');}
for(const key of ['map_lat','map_lng','chart_value'] as const)if(d[key]&&d[key]!=='id'&&!cols.some(c=>c.name===d[key]&&['number','decimal'].includes(c.type)))throw Error('พิกัดและค่ากราฟต้องเป็นคอลัมน์ตัวเลข');
if(d.map_location&&!cols.some(c=>c.name===d.map_location&&c.type==='latlong'))throw Error('แผนที่: เลือกคอลัมน์ชนิดพิกัด (Lat, Long)');
if(d.map_image&&!cols.some(c=>c.name===d.map_image&&c.type==='image'))throw Error('รูปจุดบนแผนที่ต้องเป็นคอลัมน์รูปภาพ');
for(const key of ['calendar_start','calendar_end'] as const)if(d[key]&&!cols.some(c=>c.name===d[key]&&['date','datetime'].includes(c.type)))throw Error('วันเริ่มและวันสิ้นสุดต้องเป็นคอลัมน์วันที่หรือวัน–เวลา');
for(const [key,choices]of Object.entries({chart_type:['bar','horizontal','line','area','pie','donut'],chart_aggregate:['count','sum','avg','min','max'],chart_sort:['label','value_asc','value_desc'],calendar_mode:['month','week','day','agenda'],dashboard_layout:['stack','grid','tabs']})){const v=(d as any)[key];if(v!==undefined&&!choices.includes(v))throw Error('ตัวเลือกรูปแบบแผนที่ กราฟ ปฏิทิน หรือแดชบอร์ดไม่ถูกต้อง');}
for(const [key,min,max] of [['map_zoom',1,19],['map_height',240,800],['chart_height',240,800],['chart_limit',1,100],['dashboard_columns',1,3],['dashboard_gap',0,40],['dashboard_height',240,1000]] as const){const v=d[key];if(v!==undefined&&(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max))throw Error('ขนาดหรือจำนวนรายการของ View ต้องอยู่ในช่วงที่กำหนด');}
for(const key of ['map_fit','chart_labels','calendar_show_time','dashboard_titles'] as const)if(d[key]!==undefined&&typeof d[key]!=='boolean')throw Error('ตัวเลือกแสดงผลต้องเป็นเปิดหรือปิด');
if(d.calendar_week_start!==undefined&&![0,1].includes(d.calendar_week_start))throw Error('วันเริ่มสัปดาห์ต้องเป็นอาทิตย์หรือจันทร์');
if(d.chart_color!==undefined&&(typeof d.chart_color!=='string'||d.chart_color!==''&&!/^#[a-f0-9]{6}$/i.test(d.chart_color)))throw Error('สีกราฟต้องเป็นรหัสสี เช่น #2563eb');
if(d.dashboard_views!==undefined&&(!Array.isArray(d.dashboard_views)||d.dashboard_views.length>8||new Set(d.dashboard_views).size!==d.dashboard_views.length||d.dashboard_views.some(n=>typeof n!=='string'||! /^[a-z][a-z0-9_]{0,40}$/.test(n))))throw Error('แดชบอร์ดเลือกได้ไม่เกิน 8 View และห้ามเลือกซ้ำ');
}
export function validateSpecialView(kind:string,d:ViewDisplay,views:{name:string;kind:string;position:string}[],name:string){
if(kind==='map'&&!d.map_location&&(!d.map_lat||!d.map_lng||d.map_lat===d.map_lng))throw Error('แผนที่: เลือกคอลัมน์พิกัด (Lat, Long)');
if(kind==='chart'&&(!d.chart_category||(d.chart_aggregate||'count')!=='count'&&!d.chart_value))throw Error('กราฟ: เลือกคอลัมน์แบ่งกลุ่ม และเลือกค่าตัวเลขเมื่อใช้การรวมยอด');
if(kind==='calendar'&&!d.calendar_start)throw Error('ปฏิทิน: เลือกคอลัมน์วันเริ่ม');
if(kind==='dashboard'){if(!d.dashboard_views?.length)throw Error('แดชบอร์ด: เลือกอย่างน้อย 1 View');for(const child of d.dashboard_views)if(child===name||!views.some(v=>v.name===child&&['list','table','map','chart','calendar'].includes(v.kind)&&v.position!=='inline'))throw Error('แดชบอร์ดเลือกได้เฉพาะรายการ ตาราง แผนที่ กราฟ หรือปฏิทินที่มีอยู่ และห้ามซ้อนแดชบอร์ด');}
}
