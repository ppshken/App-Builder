import {validateDashboardLayout} from './dashboard-layout';
import {parseExpression,references} from './expression';
import {customNodes,customNodeTargetError,customExpressions} from './custom-page';
import type {Column} from './columns';import type {ViewDisplay} from './view-display';
export const SPECIAL_COLUMN_KEYS=['map_location','map_image','map_lat','map_lng','map_title','chart_category','chart_value','calendar_start','calendar_end','calendar_title','calendar_color'] as const;
export function validateSpecialDisplay(d:ViewDisplay,cols:Column[]){
validateDashboardLayout(d);
if(d.map_data_view!==undefined&&(typeof d.map_data_view!=='string'||d.map_data_view!==''&&!/^[a-z][a-z0-9_]{0,40}$/.test(d.map_data_view)))throw Error('กรุณาเลือก View สำหรับข้อมูลแผนที่');
for(const key of SPECIAL_COLUMN_KEYS){const value=d[key];if(value!==undefined&&(typeof value!=='string'||value!==''&&value!=='id'&&!cols.some(c=>c.name===value)))throw Error('คอลัมน์ของแผนที่ กราฟ หรือปฏิทินไม่ถูกต้อง กรุณาเลือกจากตารางนี้');}
for(const key of ['map_lat','map_lng','chart_value'] as const)if(d[key]&&d[key]!=='id'&&!cols.some(c=>c.name===d[key]&&['number','decimal'].includes(c.type)))throw Error('พิกัดและค่ากราฟต้องเป็นคอลัมน์ตัวเลข');
if(d.map_location&&!cols.some(c=>c.name===d.map_location&&c.type==='latlong'))throw Error('แผนที่: เลือกคอลัมน์ชนิดพิกัด (Lat, Long)');
if(d.map_image&&!cols.some(c=>c.name===d.map_image&&c.type==='image'))throw Error('รูปจุดบนแผนที่ต้องเป็นคอลัมน์รูปภาพ');
for(const key of ['calendar_start','calendar_end'] as const)if(d[key]&&!cols.some(c=>c.name===d[key]&&['date','datetime'].includes(c.type)))throw Error('วันเริ่มและวันสิ้นสุดต้องเป็นคอลัมน์วันที่หรือวัน–เวลา');
for(const [key,choices]of Object.entries({map_layout:['stack','split','map_only'],map_style:['standard','muted','grayscale'],map_marker:['pin','dot','number'],chart_type:['bar','horizontal','line','area','pie','donut'],chart_aggregate:['count','sum','avg','min','max'],chart_sort:['label','value_asc','value_desc'],calendar_mode:['month','week','day','agenda'],dashboard_layout:['auto','stack','grid','tabs']})){const v=(d as any)[key];if(v!==undefined&&!choices.includes(v))throw Error('ตัวเลือกรูปแบบแผนที่ กราฟ ปฏิทิน หรือแดชบอร์ดไม่ถูกต้อง');}
for(const [key,min,max] of [['map_marker_size',8,20],['map_radius',0,24],['map_zoom',1,19],['map_height',240,800],['chart_height',240,800],['chart_limit',1,100],['dashboard_columns',1,3],['dashboard_gap',0,40],['dashboard_height',240,1000]] as const){const v=d[key];if(v!==undefined&&(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max))throw Error('ขนาดหรือจำนวนรายการของ View ต้องอยู่ในช่วงที่กำหนด');}
for(const key of ['map_show_coordinates','map_show_summary','map_scroll_zoom','map_fit','chart_labels','calendar_show_time','dashboard_titles'] as const)if(d[key]!==undefined&&typeof d[key]!=='boolean')throw Error('ตัวเลือกแสดงผลต้องเป็นเปิดหรือปิด');
if(d.calendar_week_start!==undefined&&![0,1].includes(d.calendar_week_start))throw Error('วันเริ่มสัปดาห์ต้องเป็นอาทิตย์หรือจันทร์');
if(d.map_marker_color!==undefined&&(typeof d.map_marker_color!=='string'||d.map_marker_color!==''&&!/^#[a-f0-9]{6}$/i.test(d.map_marker_color)))throw Error('สีหมุดต้องเป็นรหัสสี เช่น #2563eb');
if(d.chart_color!==undefined&&(typeof d.chart_color!=='string'||d.chart_color!==''&&!/^#[a-f0-9]{6}$/i.test(d.chart_color)))throw Error('สีกราฟต้องเป็นรหัสสี เช่น #2563eb');
if(d.dashboard_views!==undefined&&(!Array.isArray(d.dashboard_views)||d.dashboard_views.length>8||new Set(d.dashboard_views).size!==d.dashboard_views.length||d.dashboard_views.some(n=>typeof n!=='string'||! /^[a-z][a-z0-9_]{0,40}$/.test(n))))throw Error('แดชบอร์ดเลือกได้ไม่เกิน 8 View และห้ามเลือกซ้ำ');
}
export function validateSpecialView(kind:string,d:ViewDisplay,views:{name:string;kind:string;position:string;table_name?:string}[],name:string,table?:string){
if(kind==='custom'){for(const node of customNodes(d.custom_page?.children||[])){const error=customNodeTargetError(node,views.find(v=>v.name===node.view));if(error)throw Error(error);}for(const source of customExpressions(d.custom_page)){parseExpression(source);if(references(source).length)throw Error('สูตรหน้ากำหนดเองไม่มีแถวปัจจุบัน ใช้ SELECT หรือ LOOKUP แทน [คอลัมน์]');}}
if(kind==='map'&&d.map_data_view){const target=views.find(v=>v.name===d.map_data_view),ownerTable=table||views.find(v=>v.name===name)?.table_name;if(!target||!['table','list'].includes(target.kind)||target.position==='inline'||target.name===name||ownerTable&&target.table_name!==ownerTable)throw Error('ข้อมูลแผนที่ต้องเลือก View ตารางหรือรายการจากตารางเดียวกัน');}
if(kind==='map'&&!d.map_location&&(!d.map_lat||!d.map_lng||d.map_lat===d.map_lng))throw Error('แผนที่: เลือกคอลัมน์พิกัด (Lat, Long)');
if(kind==='chart'&&(!d.chart_category||(d.chart_aggregate||'count')!=='count'&&!d.chart_value))throw Error('กราฟ: เลือกคอลัมน์แบ่งกลุ่ม และเลือกค่าตัวเลขเมื่อใช้การรวมยอด');
if(kind==='calendar'&&!d.calendar_start)throw Error('ปฏิทิน: เลือกคอลัมน์วันเริ่ม');
if(kind==='dashboard'){if(Object.keys(d.dashboard_panel_sizes||{}).some(name=>!d.dashboard_views?.includes(name)))throw Error('กำหนดขนาดได้เฉพาะ View ที่เลือกในแดชบอร์ด');if(!d.dashboard_views?.length)throw Error('แดชบอร์ด: เลือกอย่างน้อย 1 View');for(const child of d.dashboard_views)if(child===name||!views.some(v=>v.name===child&&['list','table','map','chart','calendar'].includes(v.kind)&&v.position!=='inline'))throw Error('แดชบอร์ดเลือกได้เฉพาะรายการ ตาราง แผนที่ กราฟ หรือปฏิทินที่มีอยู่ และห้ามซ้อนแดชบอร์ด');}
}
