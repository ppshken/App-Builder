"use client";
import {useAuth} from "./AuthProvider";
import {pwaApplication} from "@/lib/pwa";
import { createContext, useContext, useEffect, useState } from "react";
import { fontFamily, themeColors, AppSettings, DEFAULT_SETTINGS } from "@/lib/app-settings";
const Context = createContext({ settings: DEFAULT_SETTINGS, systemDark: false, reload: async () => {} });
export const useAppSettings = () => useContext(Context);
export default function AppSettingsProvider({children,initialSettings=DEFAULT_SETTINGS}:{children:React.ReactNode;initialSettings?:AppSettings}) {
  const {user}=useAuth();
  const [settings,setSettings] = useState<AppSettings>(initialSettings), [systemDark,setSystemDark] = useState(false);
  async function reload() {
    // Guest PWA branding is supplied by the server for this installation.
    // The public branding endpoint describes the central app, not this PWA.
    if(!user&&pwaApplication(location.pathname))return;
    const r = await fetch(user?"/api/settings":"/api/branding"); const j = await r.json(); if (!r.ok) throw new Error(j.error); setSettings({...DEFAULT_SETTINGS,...j});
  }
  useEffect(()=>{ const media=matchMedia("(prefers-color-scheme:dark)"); const sync=()=>setSystemDark(media.matches);sync();media.addEventListener("change",sync);reload().catch(()=>{});const update=()=>reload().catch(()=>{});window.addEventListener("nocode:settings",update); const storage=(e:StorageEvent)=>{if(e.key==="nocode:settings")update();};window.addEventListener("storage",storage);return()=>{media.removeEventListener("change",sync);window.removeEventListener("nocode:settings",update);window.removeEventListener("storage",storage);}; },[user?.id]);
  useEffect(()=>{ const dark=settings.mode==="dark" || settings.mode==="auto"&&matchMedia("(prefers-color-scheme:dark)").matches, color=themeColors(settings,dark), root=document.documentElement;root.dataset.mode=dark?"dark":"light";root.style.setProperty("--accent",color.accent);root.style.setProperty("--accent-soft",color.soft);root.style.setProperty("--brand-color",color.button);root.style.setProperty("--brand-contrast",color.buttonText);root.style.setProperty("--app-font-family",fontFamily(settings.font));root.style.setProperty("--app-font-weight",String(settings.font_weight));root.style.setProperty("--font-scale",String(settings.font_size/14));document.title=settings.name; },[settings,systemDark]);
  return <Context.Provider value={{settings,systemDark,reload}}>{children}</Context.Provider>;
}
export function settingsChanged(){window.dispatchEvent(new Event("nocode:settings"));try{localStorage.setItem("nocode:settings",String(Date.now()));}catch{}}
