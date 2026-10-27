"use client";
import {pwaApplication} from '@/lib/pwa';

import '../apps/applications.css';
import MyProfile from "./MyProfile";
import ConnectionStatus from "./ConnectionStatus";
import DraftBanner from "./DraftBanner";
import AppIcon from "./AppIcon";

import {useAuth,logout} from "./AuthProvider";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon, { IconName } from "./Icon";
import { useAppSettings } from "./AppSettingsProvider";
type Table = { name: string; label: string; columns: unknown[] };
const MENU: {href:string;label:string;icon:IconName;description:string}[] = [
 {href:"/settings",label:"การตั้งค่าแอพ",icon:"settings",description:"ชื่อ ไอคอน สี และโหมด"},
 {href:"/data",label:"Data",icon:"database",description:"จัดการตารางฐานข้อมูล"},
 {href:"/views",label:"View",icon:"phone",description:"จัดการหน้า Page"},
 {href:"/decorations",label:"ตกแต่งข้อมูล",icon:"tag",description:"Badge ไอคอน และสีตามคอลัมน์"},
 {href:"/app-access",label:"ตารางและสิทธิ์",icon:"database",description:"เชื่อมตารางและกำหนดสิทธิ์เฉพาะแอปนี้"},
 {href:"/actions",label:"Action",icon:"formula",description:"จัดการปุ่มการทำงาน"},
 {href:"/workflows",label:"Automation",icon:"monitor",description:"งานอัตโนมัติ เชื่อม API และสร้าง PDF"},
 {href:"/performance",label:"วิเคราะห์ความช้า",icon:"clock",description:"วัด API สูตร รูปภาพ และ Automation"},
 {href:"/readiness",label:"ตรวจสุขภาพแอพ",icon:"check",description:"ตรวจปัญหาและจำลองการทำงาน"},
 {href:"/releases",label:"เวอร์ชันแอพ",icon:"folder",description:"ฉบับร่าง เผยแพร่ และย้อนเวอร์ชัน"},
 {href:"/formulas",label:"คู่มือสูตร",icon:"book",description:"ตัวอย่างและสูตรที่บันทึกไว้"},
];
export default function AppShell({ children }: { children: React.ReactNode }) {
 const pathname=usePathname(),{settings}=useAppSettings(),{user,access,application}=useAuth();
 const [profileOpen,setProfileOpen]=useState(false);
 const [tables,setTables]=useState<Table[]>([]),[open,setOpen]=useState(false),[query,setQuery]=useState(""),[collapsed,setCollapsed]=useState<Record<string,boolean>>({}),[error,setError]=useState("");
 const login=pathname==="/login"||!!pwaApplication(pathname)&&pathname.endsWith("/login");
 const launcher=pathname==="/apps"||pathname==="/";
 const runtime=pathname==="/run"||!!pwaApplication(pathname)&&!pathname.endsWith("/login"),data=pathname==="/data" || pathname.startsWith("/t/") || pathname==="/slices";
 useEffect(()=>{setOpen(false);if(runtime||login||launcher)return;const controller=new AbortController();const load=()=>fetch("/api/tables",{signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setTables(j);setError("");}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});load();window.addEventListener("nocode:metadata",load);return()=>{controller.abort();window.removeEventListener("nocode:metadata",load);};},[pathname,runtime,launcher]);
 if(launcher)return <div className="applications-launcher"><ConnectionStatus/>{profileOpen&&<MyProfile onClose={()=>setProfileOpen(false)}/>}<header className="applications-launcher-header"><a href="/apps" className="applications-launcher-brand"><Icon name="grid"/><strong>แอปของฉัน</strong></a><div><button className="auth-owner" onClick={()=>setProfileOpen(true)}>{user?.name}</button><button className="auth-logout" onClick={()=>logout().catch(e=>setError(e.message))}>ออกจากระบบ</button></div></header>{error&&<p role="alert" className="err">{error}</p>}<main className="applications-launcher-content">{children}</main></div>;
 if(runtime||login)return <><ConnectionStatus/>{children}</>;
 const current=tables.find(t=>pathname===`/t/${t.name}`||pathname.startsWith(`/t/${t.name}/`));
 const active=data?"/data":pathname;
 return <div className="builder-shell"><ConnectionStatus/>{profileOpen&&<MyProfile onClose={()=>setProfileOpen(false)}/>}
  <header className="builder-header"><button className="icon-button builder-menu-toggle" aria-label={open?"ปิดเมนูหลัก":"เปิดเมนูหลัก"} aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="menu"/></button><Link href="/settings" className="builder-brand" title="จัดการแอปที่เลือก"><span className="brand-mark"><AppIcon settings={settings}/></span><span>{settings.name}</span></Link><a href="/apps" className="button builder-back-apps" aria-label="กลับไปแอปของฉัน"><Icon name="grid"/><span>แอปของฉัน</span></a><span className="builder-heading">{MENU.find(m=>m.href===active)?.description}</span><a href={"/run?app="+encodeURIComponent(application)} target="_blank" rel="noreferrer" className="button builder-open-app"><Icon name="external"/><span>เปิดแอป</span></a><DraftBanner/><button className="auth-owner" title="โปรไฟล์ของฉัน" onClick={()=>setProfileOpen(true)}>{user?.name}</button><button className="auth-logout" onClick={()=>logout().catch(e=>setError(e.message))}>ออกจากระบบ</button></header>
  <nav className={`builder-global-nav ${open?"is-open":""}`} aria-label="เมนูหลัก">{MENU.filter(m=>!["/users","/audit-log"].includes(m.href)||access.owner).map(m=><Link key={m.href} href={m.href} aria-label={m.label} title={m.description} aria-current={active===m.href?"page":undefined} onClick={()=>setOpen(false)}><Icon name={m.icon} width="23" height="23"/><span>{m.label}</span></Link>)}</nav>
  {open&&<button className="builder-nav-overlay" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}/>}
  <main className={`builder-canvas ${pathname==="/workflows"?"is-workflows":""} ${data?"is-data":pathname==="/views"?"is-views":pathname==="/actions"?"is-actions":"is-page"}`}>
   {data?<div className="data-workspace"><aside className="data-navigator" aria-label="ตารางฐานข้อมูล"><div className="data-navigator-heading"><h2>Data</h2><span className="badge">{tables.length}</span><Link href="/data?new=1" role="button" className="icon-button button" aria-label="เพิ่มตาราง" title="เพิ่มตาราง" onKeyDown={e=>{if(e.key===" "){e.preventDefault();e.currentTarget.click();}}} onClick={e=>{if(pathname==="/data"){e.preventDefault();window.dispatchEvent(new Event("nocode:new-table"));}}}><Icon name="plus"/></Link></div><div className="designer-view-search"><Icon name="search" width="16" height="16"/><input aria-label="ค้นหาตารางในเมนู" placeholder="ค้นหาตาราง…" value={query} onChange={e=>setQuery(e.target.value)}/></div><nav aria-label="รายชื่อตาราง">{tables.filter(t=>`${t.label} ${t.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(t=>{const selected=current?.name===t.name,expanded=selected&&!collapsed[t.name];return <div className="data-table-group" key={t.name}><div className={`data-table-link ${selected?"selected":""}`}><Link href={`/t/${t.name}/edit`} aria-label={`เลือกตาราง ${t.label}`} onClick={()=>setCollapsed(s=>({...s,[t.name]:false}))}><Icon name="database" width="17" height="17"/><span>{t.label}</span></Link>{selected?<button className="icon-button" aria-label={`${expanded?"ย่อ":"ขยาย"}ตาราง ${t.label}`} aria-expanded={expanded} onClick={()=>setCollapsed(s=>({...s,[t.name]:!s[t.name]}))}><Icon name="chevron" width="14" height="14"/></button>:<Link href={`/t/${t.name}/edit`} role="button" className="icon-button button data-table-expander" aria-label={`ขยายตาราง ${t.label}`} aria-expanded={false} onKeyDown={e=>{if(e.key===" "){e.preventDefault();e.currentTarget.click();}}} onClick={()=>setCollapsed(s=>({...s,[t.name]:false}))}><Icon name="chevron" width="14" height="14"/></Link>}</div>{expanded&&<nav className="data-table-tabs" aria-label={`จัดการตาราง ${t.label}`}><Link href={`/t/${t.name}/edit`} aria-current={pathname.endsWith("/edit")?"page":undefined}><Icon name="settings" width="15" height="15"/>คอลัมน์<span>{t.columns.length}</span></Link><Link href={`/t/${t.name}`} aria-current={pathname===`/t/${t.name}`?"page":undefined}><Icon name="table" width="15" height="15"/>ข้อมูล</Link><Link href={`/t/${t.name}/raw`} aria-current={pathname.endsWith("/raw")?"page":undefined}><Icon name="database" width="15" height="15"/>ข้อมูลจริงในฐานข้อมูล</Link></nav>}</div>;})}</nav>{!tables.length&&!error&&<p className="designer-list-empty">ยังไม่มีตาราง กด + เพื่อเพิ่ม</p>}{error&&<p className="err" role="alert">{error}</p>}<div className="data-navigator-slices"><h3>เครื่องมือข้อมูล</h3><Link href="/slices" aria-current={pathname==="/slices"?"page":undefined}><Icon name="list" width="17" height="17"/>จัดการ Slice</Link></div><p className="data-navigator-foot">ข้อมูลเก็บใน data.db<br/>สำรองก่อนเปลี่ยนโครงสร้าง</p></aside><section className="data-editor" aria-label={current?`ตาราง ${current.label}`:"จัดการ Data"}>{children}</section></div>:pathname==="/views"||pathname==="/actions"||pathname==="/decorations"?children:<div className="builder-page">{children}</div>}
  </main>
 </div>;
}
export function metadataChanged(){window.dispatchEvent(new Event("nocode:metadata"));}