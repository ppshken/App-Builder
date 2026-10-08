"use client";
import {useState} from "react";
import type {AppView} from "@/lib/views";
import type {DisplayKind,GlobalDisplayDefaults} from "@/lib/view-display";
import DefaultLayoutPreview from "./DefaultLayoutPreview";
import ViewDisplayEditor from "./ViewDisplayEditor";
export default function AppDisplayDefaultsEditor({value,busy,onChange}:{value:GlobalDisplayDefaults;busy:boolean;onChange:(value:GlobalDisplayDefaults)=>void}) {
 const [kind,setKind]=useState<DisplayKind>("detail");
 const view:AppView={name:"defaults",label:"ค่าตั้งต้น",table_name:"",kind,position:"primary",pos:0,columns:[],sort_column:"id",sort_dir:"desc",display:value[kind]||{}};
 return <section className="panel app-display-defaults" aria-label="ค่าตั้งต้นรูปแบบหน้าจอ"><h2>ค่าตั้งต้นรูปแบบหน้าจอ</h2><p className="hint">ตั้งครั้งเดียวใช้กับทุกหน้า รายการ ตาราง รายละเอียด ฟอร์ม และ Related · ค่าที่กำหนดเฉพาะใน View จะใช้แทนค่าตั้งต้น</p><div className="defaults-tabs" role="tablist" aria-label="ชนิดหน้าจอตั้งต้น">{([["list","รายการ"],["table","ตาราง"],["detail","รายละเอียด"],["form","ฟอร์ม"],["map","แผนที่"],["chart","กราฟ"],["calendar","ปฏิทิน"],["dashboard","แดชบอร์ด"]] as const).map(([key,label])=><button type="button" key={key} role="tab" aria-selected={kind===key} onClick={()=>setKind(key)}>{label}</button>)}</div><div className="defaults-workspace"><div><ViewDisplayEditor view={view} cols={[]} busy={busy} defaultsMode onChange={display=>onChange({...value,[kind]:display})} onColumns={()=>{}}/><button type="button" disabled={busy||!Object.keys(value[kind]||{}).length} onClick={()=>{const next={...value};delete next[kind];onChange(next);}}>คืนค่ารูปแบบตั้งต้นของ{({list:"รายการ",table:"ตาราง",detail:"รายละเอียด",form:"ฟอร์ม",map:"แผนที่",chart:"กราฟ",calendar:"ปฏิทิน",dashboard:"แดชบอร์ด"})[kind]}</button></div><DefaultLayoutPreview kind={kind} value={value[kind]}/></div></section>;
}
