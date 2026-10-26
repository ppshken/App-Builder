import { columnsOf, db } from "./db";
import type { ViewDisplay } from "./view-display";
import type { AppView } from "./views";
import { relatedLists } from "./lists";
export function inlineView(name: string): AppView | undefined {
  const v = db.prepare("SELECT * FROM _views WHERE name=? AND position='inline'").get(name) as any;
  if(!v)return; const {columns_json,display_json,...rest}=v;return {...rest,columns:JSON.parse(columns_json),display:JSON.parse(display_json)};
}
export function validateRelatedDisplay(display: ViewDisplay, table: string, kind: string) {
  if(!Object.keys(display.related || {}).length)return;
  if(!["detail","form"].includes(kind))throw new Error("ตั้งค่า Related ได้ใน View รายละเอียดและฟอร์มเท่านั้น");
  const related=relatedLists(table);
  for(const [key,r] of Object.entries(display.related || {})) {
    const relation=related.find(x=>`${x.table}:${x.column}`===key);
    if(!relation)throw new Error("ไม่พบ Related นี้ กรุณาเลือกความสัมพันธ์ของตารางนี้");
    if(r.view){const view=inlineView(r.view);if(!view || view.table_name!==relation.table || view.inline_ref!==relation.column)throw new Error("กรุณาเลือก Inline View ที่ตรงกับ Ref ของ Related นี้");}
  }
}
export function inlineBindings(name: string) {
  return (db.prepare("SELECT name,label,display_json FROM _views").all() as {name:string;label:string;display_json:string}[]).filter(v=>Object.values((JSON.parse(v.display_json) as ViewDisplay).related || {}).some(r=>r.view===name));
}
export function changeRelatedReference(table: string, old: string, next?: string) {
  for(const v of db.prepare("SELECT name,display_json FROM _views").all() as {name:string;display_json:string}[]) {
    const display=JSON.parse(v.display_json) as ViewDisplay, key=`${table}:${old}`;
    if(!Object.hasOwn(display.related || {},key))continue;
    const related={...display.related},config=related[key];delete related[key];if(next)related[`${table}:${next}`]=config;
    db.prepare("UPDATE _views SET display_json=? WHERE name=?").run(JSON.stringify({...display,related}),v.name);
  }
  if(next)db.prepare("UPDATE _views SET inline_ref=? WHERE table_name=? AND inline_ref=?").run(next,table,old);
  else db.prepare("DELETE FROM _views WHERE table_name=? AND position='inline' AND inline_ref=?").run(table,old);
}
