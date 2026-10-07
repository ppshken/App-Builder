import {validateSpecialDisplay,SPECIAL_COLUMN_KEYS} from "./special-view-config";
import type { Column } from "./columns";
export type FormFieldDisplay = { width?: "full" | "half"; section?: string; help?: string; placeholder?: string; multiline?: boolean };
export type RelatedDisplay = { view?: string; title?: string; visible?: boolean; limit?: 0|5|10|20 };
export type ViewDisplay = {
  map_location?:string;map_image?:string;map_lat?:string;map_lng?:string;map_title?:string;map_zoom?:number;map_height?:number;map_fit?:boolean;
  chart_type?:'bar'|'horizontal'|'line'|'area'|'pie'|'donut';chart_category?:string;chart_value?:string;chart_aggregate?:'count'|'sum'|'avg'|'min'|'max';chart_sort?:'label'|'value_asc'|'value_desc';chart_limit?:number;chart_height?:number;chart_color?:string;chart_labels?:boolean;
  calendar_start?:string;calendar_end?:string;calendar_title?:string;calendar_color?:string;calendar_mode?:'month'|'week'|'day'|'agenda';calendar_week_start?:number;calendar_show_time?:boolean;
  dashboard_views?:string[];dashboard_layout?:'stack'|'grid'|'tabs';dashboard_columns?:number;dashboard_gap?:number;dashboard_height?:number;dashboard_titles?:boolean;

  list_style?: "compact" | "card" | "outlined" | "striped" | "grid"; image_column?: string; image_shape?: "square" | "round" | "wide"; image_size?: "small" | "medium" | "large";
  title_column?: string; summary_columns?: string[] | null; show_summary_labels?: boolean; list_buttons?: "edit" | "actions" | "both" | "none";
  list_grid_columns?: number; list_grid_mobile_columns?: number; list_padding?: number; list_min_height?: number; list_gap?: number; list_radius?: number;
  table_density?: "comfortable" | "compact"; table_wrap?: boolean; row_click?: "detail" | "edit" | "delete" | "action" | "none"; row_action?: string;
  detail_layout?: "vertical" | "horizontal"; detail_columns?: 1 | 2;
  detail_style?: "plain" | "card"; detail_image_mode?: "inline" | "cover"; detail_cover_column?: string; detail_cover_height?: number; detail_image_fit?: "cover" | "contain"; detail_image_radius?: number;
  detail_padding?: number; detail_row_spacing?: number; detail_line_height?: number; detail_separator?: "solid" | "dashed" | "none"; detail_show_labels?: boolean; detail_hide_empty?: boolean;
  form_after_save?:"back"|"detail"; form_columns?: 1 | 2; form_labels?: "top" | "left"; form_fields?: Record<string, FormFieldDisplay>;
  related?: Record<string, RelatedDisplay>;
};
export const DISPLAY_DEFAULTS = {map_location:"",map_image:"",map_lat:"",map_lng:"",map_title:"",map_zoom:12,map_height:420,map_fit:true,chart_type:"bar",chart_category:"",chart_value:"",chart_aggregate:"count",chart_sort:"value_desc",chart_limit:20,chart_height:360,chart_color:"",chart_labels:true,calendar_start:"",calendar_end:"",calendar_title:"",calendar_color:"",calendar_mode:"month",calendar_week_start:1,calendar_show_time:true,dashboard_views:[],dashboard_layout:"stack",dashboard_columns:2,dashboard_gap:16,dashboard_height:420,dashboard_titles:true, list_style: "compact", list_grid_columns: 3, list_grid_mobile_columns: 2, list_padding: 8, list_min_height: 78, list_gap: 0, list_radius: 12, image_column: "__auto__", image_shape: "square", image_size: "medium", title_column: "__auto__", summary_columns: null, show_summary_labels: true, list_buttons: "edit", table_density: "comfortable", table_wrap: false, row_click: "detail", row_action: "", detail_layout: "vertical", detail_columns: 1, detail_style: "plain", detail_image_mode: "inline", detail_cover_column: "__auto__", detail_cover_height: 240, detail_image_fit: "cover", detail_image_radius: 0, detail_padding: 18, detail_row_spacing: 14, detail_line_height: 1.7, detail_separator: "solid", detail_show_labels: true, detail_hide_empty: false, form_after_save:"back", form_columns: 1, form_labels: "top", form_fields: {}, related: {} } satisfies ViewDisplay;
export function displaySettings(value?: ViewDisplay, defaults?: ViewDisplay) { return { ...DISPLAY_DEFAULTS, ...defaults, ...value } as Required<ViewDisplay>; }
export function validateDisplay(value: unknown, cols: Column[]): ViewDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 100000) throw new Error("รูปแบบหน้าจอไม่ถูกต้อง กรุณาเลือกการตั้งค่าจากหน้า View");
  validateSpecialDisplay(value as ViewDisplay,cols);
  const v = value as ViewDisplay, names = new Set(cols.map(c => c.name));
  if (Object.keys(v).some(k => !Object.hasOwn(DISPLAY_DEFAULTS, k))) throw new Error("ไม่รู้จักตัวเลือกรูปแบบหน้าจอ");
  for (const [key, choices] of Object.entries({ list_style: ["compact", "card", "outlined", "striped", "grid"], image_shape: ["square", "round", "wide"], image_size: ["small", "medium", "large"], list_buttons: ["edit", "actions", "both", "none"], table_density: ["comfortable", "compact"], row_click: ["detail", "edit", "delete", "action", "none"], detail_layout: ["vertical", "horizontal"], detail_style: ["plain", "card"], detail_image_mode: ["inline", "cover"], detail_image_fit: ["cover", "contain"], detail_separator: ["solid", "dashed", "none"], form_after_save:["back","detail"], form_labels: ["top", "left"] })) if ((v as Record<string, unknown>)[key] !== undefined && (typeof (v as Record<string, unknown>)[key] !== "string" || !choices.includes((v as Record<string, unknown>)[key] as string))) throw new Error("ตัวเลือกรูปแบบหน้าจอไม่ถูกต้อง");
  for (const key of ["show_summary_labels", "table_wrap", "detail_show_labels", "detail_hide_empty"]) if ((v as Record<string, unknown>)[key] !== undefined && typeof (v as Record<string, unknown>)[key] !== "boolean") throw new Error("ตัวเลือกเปิด/ปิดรูปแบบหน้าจอไม่ถูกต้อง");
  for (const key of ["form_columns", "detail_columns"]) if ((v as Record<string, unknown>)[key] !== undefined && ![1, 2].includes((v as Record<string, unknown>)[key] as number)) throw new Error("จำนวนช่องต่อแถวต้องเป็น 1 หรือ 2");
  for (const [key, min, max, integer] of [["detail_cover_height", 120, 600, true], ["detail_image_radius", 0, 32, true], ["detail_padding", 8, 40, true], ["detail_row_spacing", 0, 40, true], ["detail_line_height", 1, 3, false]] as const) { const n = v[key]; if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || integer && !Number.isInteger(n))) throw new Error(`${{detail_cover_height:"ความสูงรูปปก",detail_image_radius:"ความโค้งมุมรูปปก",detail_padding:"ระยะขอบรายละเอียด",detail_row_spacing:"ระยะห่างช่องรายละเอียด",detail_line_height:"ระยะห่างบรรทัดรายละเอียด"}[key]} ต้องอยู่ระหว่าง ${min}–${max}${integer ? " และเป็นจำนวนเต็ม" : ""}`); }
  for(const [key,min,max] of [["list_grid_columns",1,6],["list_grid_mobile_columns",1,3],["list_padding",0,40],["list_min_height",40,240],["list_gap",0,32],["list_radius",0,32]] as const){const n=v[key];if(n!==undefined&&(typeof n!=="number"||!Number.isInteger(n)||n<min||n>max))throw Error("ระยะห่างหรือขนาดรายการไม่ถูกต้อง กรุณาเลือกค่าภายในช่วงที่กำหนด");}
  if (v.detail_cover_column !== undefined && v.detail_cover_column !== "__auto__" && v.detail_cover_column !== "" && !cols.some(c => c.name === v.detail_cover_column && c.type === "image")) throw new Error("กรุณาเลือกคอลัมน์รูปปกที่เป็นรูปภาพจากตารางหรือ Slice นี้");
  if (v.row_action !== undefined && (typeof v.row_action !== "string" || v.row_action !== "" && !/^[a-z][a-z0-9_]{0,40}$/.test(v.row_action))) throw new Error("ชื่อ Action ของการคลิกแถวไม่ถูกต้อง");
  if (v.title_column !== undefined && v.title_column !== "__auto__" && !names.has(v.title_column)) throw new Error("กรุณาเลือกคอลัมน์หัวเรื่องจากตารางหรือ Slice นี้");
  if (v.image_column !== undefined && v.image_column !== "__auto__" && v.image_column !== "" && !cols.some(c => c.name === v.image_column && c.type === "image")) throw new Error("กรุณาเลือกคอลัมน์รูปภาพจากตารางหรือ Slice นี้");
  if (v.summary_columns !== undefined && v.summary_columns !== null && (!Array.isArray(v.summary_columns) || v.summary_columns.length > 200 || new Set(v.summary_columns).size !== v.summary_columns.length || v.summary_columns.some(n => !names.has(n)))) throw new Error("คอลัมน์ข้อความประกอบไม่ถูกต้อง");
  if (v.form_fields !== undefined) {
    if (!v.form_fields || typeof v.form_fields !== "object" || Array.isArray(v.form_fields) || Object.keys(v.form_fields).length > 200) throw new Error("รูปแบบช่องฟอร์มไม่ถูกต้อง");
    for (const [name, field] of Object.entries(v.form_fields)) {
      if (!names.has(name) || !field || typeof field !== "object" || Array.isArray(field) || Object.keys(field).some(k => !["width", "section", "help", "placeholder", "multiline"].includes(k))) throw new Error("กรุณาตั้งค่าช่องฟอร์มจากตารางหรือ Slice นี้");
      if (field.width !== undefined && !["full", "half"].includes(field.width)) throw new Error("ความกว้างช่องฟอร์มไม่ถูกต้อง");
      for (const [key, max] of [["section", 100], ["help", 300], ["placeholder", 150]] as const) if (field[key] !== undefined && (typeof field[key] !== "string" || field[key].length > max)) throw new Error(`${{section: "หัวข้อแบ่งกลุ่ม", help: "คำแนะนำ", placeholder: "ข้อความในช่องว่าง"}[key]} ต้องไม่เกิน ${max} ตัวอักษร`);
      if (field.multiline !== undefined && (typeof field.multiline !== "boolean" || field.multiline && !cols.some(c => c.name === name && c.type === "text" && !c.is_virtual))) throw new Error("ข้อความหลายบรรทัดใช้กับช่องข้อความที่กรอกได้เท่านั้น");
    }
  }
  if(v.related !== undefined) {
    if(!v.related || typeof v.related !== "object" || Array.isArray(v.related) || Object.keys(v.related).length>200) throw new Error("รูปแบบ Related ไม่ถูกต้อง");
    for(const [key,r] of Object.entries(v.related)) {
      if(!/^[a-z][a-z0-9_]{0,40}:[a-z][a-z0-9_]{0,40}$/.test(key) || !r || typeof r!=="object" || Array.isArray(r) || Object.keys(r).some(k=>!["view","title","visible","limit"].includes(k))) throw new Error("การตั้งค่า Related ไม่ถูกต้อง");
      if(r.view !== undefined && (typeof r.view!=="string" || r.view!=="" && !/^[a-z][a-z0-9_]{0,40}$/.test(r.view))) throw new Error("ชื่อ Inline View ไม่ถูกต้อง");
      if(r.title!==undefined && (typeof r.title!=="string" || r.title.length>100)) throw new Error("หัวข้อ Related ต้องไม่เกิน 100 ตัวอักษร");
      if(r.visible!==undefined && typeof r.visible!=="boolean") throw new Error("การแสดง Related ต้องเป็นเปิดหรือปิด");
      if(r.limit!==undefined && ![0,5,10,20].includes(r.limit)) throw new Error("จำนวน Related ต่อหน้าต้องเป็น 5, 10, 20 หรือทั้งหมด");
    }
  }
  return v;
}
export function displayColumnNames(value: ViewDisplay = {}) { return [...new Set([...SPECIAL_COLUMN_KEYS.map(k=>value[k]),value.title_column, value.image_column, value.detail_cover_column, ...(value.summary_columns || []), ...Object.keys(value.form_fields || {})].filter(n => n && n !== "__auto__"))] as string[]; }
export function changeDisplayColumn(value: ViewDisplay, old: string, next?: string): ViewDisplay {
  const result = { ...value };
  for(const key of SPECIAL_COLUMN_KEYS)if(result[key]===old)result[key]=next||"";
  if (result.title_column === old) result.title_column = next || "__auto__";
  if (result.image_column === old) result.image_column = next || "__auto__";
  if (result.detail_cover_column === old) result.detail_cover_column = next || "__auto__";
  if (result.summary_columns) result.summary_columns = result.summary_columns.flatMap(n => n === old ? next ? [next] : [] : [n]);
  if (result.form_fields) result.form_fields = Object.fromEntries(Object.entries(result.form_fields).flatMap(([n, settings]) => n === old ? next ? [[next, settings]] : [] : [[n, settings]]));
  return result;
}

export type DisplayKind = "list" | "table" | "detail" | "form" | "map" | "chart" | "calendar" | "dashboard";
export type GlobalDisplayDefaults = Partial<Record<DisplayKind, ViewDisplay>>;
export const GLOBAL_DISPLAY_KEYS: Record<DisplayKind, (keyof ViewDisplay)[]> = {
  map:["map_zoom","map_height","map_fit"],chart:["chart_type","chart_aggregate","chart_sort","chart_limit","chart_height","chart_color","chart_labels"],calendar:["calendar_mode","calendar_week_start","calendar_show_time"],dashboard:["dashboard_layout","dashboard_columns","dashboard_gap","dashboard_height","dashboard_titles"],
  list: ["list_grid_columns", "list_grid_mobile_columns", "list_padding", "list_min_height", "list_gap", "list_radius", "list_style", "image_column", "image_shape", "image_size", "show_summary_labels", "list_buttons"],
  table: ["table_density", "table_wrap", "row_click", "list_buttons"],
  detail: ["detail_layout", "detail_columns", "image_size", "detail_style", "detail_image_mode", "detail_cover_height", "detail_image_fit", "detail_image_radius", "detail_padding", "detail_row_spacing", "detail_line_height", "detail_separator", "detail_show_labels", "detail_hide_empty"],
  form: ["form_columns", "form_labels", "form_after_save"],
};
export function validateGlobalDisplayDefaults(value: unknown): GlobalDisplayDefaults {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 10000) throw new Error("ค่าตั้งต้นรูปแบบหน้าจอไม่ถูกต้อง");
  for (const [kind, options] of Object.entries(value)) {
    if (!Object.hasOwn(GLOBAL_DISPLAY_KEYS, kind) || !options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !GLOBAL_DISPLAY_KEYS[kind as DisplayKind].includes(key as keyof ViewDisplay))) throw new Error("ค่าตั้งต้นต้องเป็นรูปแบบทั่วไปของรายการ ตาราง รายละเอียด หรือฟอร์ม ไม่สามารถกำหนดคอลัมน์หรือ Action ของตารางใดตารางหนึ่งได้");
    validateDisplay(options, []);
    const d = options as ViewDisplay;
    if (d.row_click === "action") throw new Error("Action ต้องกำหนดแยกใน View ของแต่ละตาราง");
  }
  return value as GlobalDisplayDefaults;
}
