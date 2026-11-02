import { ICON_CATALOG, type IconName } from "./icons";
import type { ViewDisplay } from "./view-display";
export const VIEW_KINDS = [["custom", "กำหนดเอง"], ["table", "ตาราง"], ["list", "รายการ"], ["detail", "รายละเอียด"], ["form", "ฟอร์ม"], ["map","แผนที่"], ["chart","กราฟ"], ["calendar","ปฏิทิน"], ["dashboard","แดชบอร์ด"]] as const;
export const VIEW_POSITIONS = [["primary", "Primary Navigation", "แถบนำทางหลัก"], ["menu", "Menu Navigation", "เมนูของแอป"], ["ref", "Reference View", "ใช้เปิดรายละเอียดหรือฟอร์ม ไม่แสดงในเมนู"], ["inline", "Inline Views", "แสดงรายการ Related ภายในรายละเอียดของตารางอ้างอิง"]] as const;
export const VIEW_ICONS = ICON_CATALOG.map(i => [i.name as IconName, i.label] as const);
export function viewIcon(view: { icon?: string; show_if?: string; kind: string }) { return VIEW_ICONS.find(([icon]) => icon === view.icon)?.[0] || (view.kind === "map" ? "map" : view.kind === "chart" ? "chart-bar" : view.kind === "calendar" ? "calendar" : ["dashboard","custom"].includes(view.kind) ? "grid" : view.kind === "table" ? "table" : view.kind === "form" ? "edit" : view.kind === "detail" ? "eye" : "list"); }
export type AppView = { system_generated?:number; name: string; label: string; table_name: string; slice_name?: string | null; inline_ref?: string; kind: string; position: string; menu_group?: string | null; pos: number; columns: string[]; sort_column: string; sort_dir: string; icon?: string; show_if?: string; group_column?: string; group_dir?: string; display?: ViewDisplay };
export function visibleColumns<T extends { name: string }>(cols: T[], selected: string[]) { return selected.length ? selected.flatMap(n => cols.find(c => c.name === n) ? [cols.find(c => c.name === n)!] : []) : cols; }

export function relatedInlineView(views:AppView[],table:string,column:string,selected?:string){return selected?views.find(v=>v.position==="inline"&&v.name===selected&&v.table_name===table&&v.inline_ref===column):views.find(v=>v.position==="inline"&&v.table_name===table&&v.inline_ref===column);}

export function relatedTitle(label:string,custom?:string){return custom?.trim()||`Related · ${label}`;}

export function menuViewGroups(views:AppView[]){
  const groups=new Map<string,AppView[]>();
  for(const view of views){
    const name=view.position==="menu"?view.menu_group?.trim()||"":"";
    const items=groups.get(name);
    if(items)items.push(view);else groups.set(name,[view]);
  }
  return [...groups].map(([name,views])=>({name,views}));
}

// Use one form resolver for normal table entry and embedded related entry.
export function tableFormView(views:AppView[],table:string,hidden:string[]=[],slice?:string|null){const forms=views.filter(v=>v.table_name===table&&v.kind==='form'&&v.position!=='inline'&&!hidden.includes(v.name));const scoped=forms.filter(v=>(v.slice_name||'')===(slice||''));const candidates=scoped.length?scoped:forms.filter(v=>!v.slice_name);return candidates.find(v=>v.position==='ref')||candidates[0];}

/** Designer category only; generated views retain reference behavior at runtime. */
export function viewCategory(view:AppView){return view.system_generated===1&&view.position==="ref"?"system":view.position;}
export const VIEW_CATEGORIES=[...VIEW_POSITIONS,["system","System Generated","หน้ารายละเอียดและฟอร์มที่ระบบสร้างให้อัตโนมัติ"]] as const;
