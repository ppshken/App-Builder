"use client";
import {useLayoutEffect,useRef,useState,type CSSProperties} from "react";
import {useAuth} from "./AuthProvider";
import AppIcon from "./AppIcon";
import Icon from "./Icon";
import type {AppSettings} from "@/lib/app-settings";
import {headerProfileImage,type HeaderSettings} from "@/lib/header-settings";
export default function AppHeader({app,settings,viewTitle,userName="",userSettings={},menuOpen=false,onMenu,onReload,onProfile,onNotifications,notificationsAvailable=true,preview=false,covered=false,screenHostRef}:{app:AppSettings;settings:HeaderSettings;viewTitle:string;userName?:string;userSettings?:Record<string,unknown>;menuOpen?:boolean;onMenu:()=>void;onReload:()=>void;onProfile:()=>void;onNotifications:()=>void;notificationsAvailable?:boolean;preview?:boolean;covered?:boolean;screenHostRef?:(element:HTMLDivElement|null)=>void}){
 const {workspace,user}=useAuth();
 const root=useRef<HTMLElement>(null),controls=useRef<HTMLDivElement>(null),[compact,setCompact]=useState(false),[side,setSide]=useState(44),[failed,setFailed]=useState("");
 useLayoutEffect(()=>{const el=controls.current;if(!el)return;const sync=()=>{const width=Math.max(44,Math.ceil(el.getBoundingClientRect().width));setSide(width);setCompact((root.current?.clientWidth||640)-2*width-40<120);};sync();const observer=new ResizeObserver(sync);observer.observe(el);if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>{if(root.current)root.current.inert=covered;},[covered]);
 const profile=user?.avatar||headerProfileImage(settings,userSettings),initial=Array.from(userName.trim()||"ผู้ใช้")[0].toUpperCase();
 return <header ref={root} aria-hidden={covered||undefined} className={"app-header header-title-"+settings.title_position+(compact?" header-center-compact":"")+(preview?" header-preview":" runtime-header")} style={{"--header-side-width":side+"px"} as CSSProperties}>
 <div className="runtime-header-screen-slot" ref={screenHostRef}/>
 <div className="header-menu"><button type="button" className="icon-button" aria-label={menuOpen?"ปิดเมนูแอป":"เปิดเมนูแอป"} aria-expanded={menuOpen} onClick={onMenu}><Icon name="menu"/></button></div>
 <div className="header-brand runtime-brand">{settings.show_app_image&&<span className={"runtime-app-icon header-app-image image-"+settings.image_shape}><AppIcon settings={{icon:app.icon,icon_image:settings.app_image||app.icon_image}} preview={preview||!!settings.app_image}/></span>}{settings.title_source!=="none"&&<div className="header-title-text">{settings.title_source==="both"&&<small>{app.name}</small>}<h1 title={settings.title_source==="app"?app.name:viewTitle}>{settings.title_source==="app"?app.name:viewTitle}</h1></div>}{workspace!=="live"&&<span className="header-workspace-badge" title="กำลังใช้ข้อมูลทดลองในฉบับร่าง">ฉบับร่าง</span>}</div>
 <div className="header-actions" ref={controls}>{settings.show_notifications&&notificationsAvailable&&<button type="button" className="icon-button" aria-label="การแจ้งเตือน" title="การแจ้งเตือน" onClick={onNotifications}><Icon name="bell"/></button>}{settings.show_reload&&<button type="button" className="icon-button" aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่" onClick={onReload}><Icon name="refresh"/></button>}{settings.show_profile&&<button type="button" className="icon-button header-profile-button" aria-label="โปรไฟล์ของฉัน" title={userName||"โปรไฟล์ของฉัน"} onClick={onProfile}><span className="header-profile-image">{profile&&failed!==profile?<img ref={image=>{if(image?.complete&&!image.naturalWidth)setFailed(profile);}} src={profile} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(profile)}/>:<span aria-hidden="true">{initial}</span>}</span></button>}</div>
 </header>;
}
