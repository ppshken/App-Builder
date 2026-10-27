import {pwaBrand} from '@/lib/pwa-server';
import {pwaBase} from '@/lib/pwa';
import {applicationCookie,withApplication} from '@/lib/application-context';
import {applicationScopeFor} from '@/lib/applications';
import RealtimeSync from "./components/RealtimeSync";
import {withDatabase} from "@/lib/db";
import {DRAFT_COOKIE,openDraft} from "@/lib/releases";
import "leaflet/dist/leaflet.css";
import {landingPage} from "@/lib/landing-page";
import {readAppSettings} from "@/lib/settings-server";
import {fontFamily,themeColors} from "@/lib/app-settings";
import type {CSSProperties} from "react";
import {headers,cookies} from "next/headers";
import {redirect} from "next/navigation";
import {sessionUser,ownerExists,SESSION_COOKIE} from "@/lib/auth";
import {expressionUser} from "@/lib/user-settings";
import {accessFor} from "@/lib/permissions";
import {NO_ACCESS} from "@/lib/access";
import AuthProvider from "./components/AuthProvider";
import "./fonts.css";
import "./globals.css";
import "./runtime-layout.css";
import ImagePreviewProvider from "./components/ImagePreviewProvider";
import AppShell from "./components/AppShell";
import AppSettingsProvider from "./components/AppSettingsProvider";
export async function generateMetadata(){const id=headers().get('x-nocode-pwa'),brand=id?pwaBrand(id):null;return brand?{title:brand.name,manifest:pwaBase(id!)+ 'manifest.webmanifest',appleWebApp:{capable:true,title:brand.name,statusBarStyle:'default' as const},icons:{apple:pwaBase(id!)+'icon/192'}}:{title:'No-code Builder'};}
export default async function Root({ children }: { children: React.ReactNode }) {
  const pwa=headers().get("x-nocode-pwa"),path=headers().get("x-nocode-path") || "/", user=sessionUser(cookies().get(SESSION_COOKIE)?.value || ""), needsSetup=!ownerExists();
  if(path.split("?")[0]!=="/login"&&!user)redirect((pwa?pwaBase(pwa)+"login":"/login")+"?next="+encodeURIComponent(pwa?pwaBase(pwa)+new URL(path,"http://local").search:path));
  const page=path.split('?')[0];if(user&&page==='/apps'&&new URL(path,'http://local').searchParams.get('tab')==='central'&&user.role!=='owner')redirect('/apps');let application:ReturnType<typeof applicationScopeFor>|undefined;
  if(user&&page!=='/login'){try{application=applicationScopeFor(user,pwa||applicationCookie(cookies().toString()));}catch{if(page!=='/apps')redirect('/apps');application=undefined;}}
  const requested=new URL(path,'http://local').searchParams.get('app');if(!pwa&&user&&page==='/run'&&requested&&requested!==application?.id)redirect('/apps?open='+encodeURIComponent(requested)+'&next='+encodeURIComponent(path));
  const access=user?(application&&page!=='/apps'?withApplication(application,()=>accessFor(user)):accessFor(user)):NO_ACCESS;
  if(page==="/login"&&user)redirect(pwa?pwaBase(pwa):landingPage(user));
  if(user&&page!=="/login"&&page!=="/run"&&page!=="/apps"&&page!=="/"&&(!access.builder||((page==="/users"||page==="/backups"||page==="/audit-log")&&!access.owner)))redirect("/run");
  const scoped=<T,>(work:()=>T)=>application?withApplication(application,work):work();
  let settings=scoped(()=>readAppSettings(!user||!application));if(pwa&&!user){const brand=pwaBrand(pwa);if(brand)settings={...settings,name:brand.name,icon_image:pwaBase(pwa)+"icon/192"};}const draftId=pwa?undefined:cookies().get(DRAFT_COOKIE)?.value;
  if(draftId&&user&&access.builder&&page!=="/login"&&page!=="/releases"){try{const draft=scoped(()=>openDraft(draftId,user.id));try{settings=scoped(()=>withDatabase(draft,()=>readAppSettings()));}finally{draft.close();}}catch{}}
  const dark=settings.mode==="dark",colors=themeColors(settings,dark);
  const style={"--accent":colors.accent,"--accent-soft":colors.soft,"--brand-color":colors.button,"--brand-contrast":colors.buttonText,"--app-font-family":fontFamily(settings.font),"--app-font-weight":String(settings.font_weight),"--font-scale":String(settings.font_size/14)} as CSSProperties;
  const palettes=JSON.stringify({light:themeColors(settings,false),dark:themeColors(settings,true)}).replace(/</g,"\\u003c");
  const bootstrap=`(()=>{const root=document.documentElement,dark=matchMedia('(prefers-color-scheme:dark)').matches,palette=(${palettes})[dark?'dark':'light'];root.dataset.mode=dark?'dark':'light';for(const [key,value] of Object.entries({'--accent':palette.accent,'--accent-soft':palette.soft,'--brand-color':palette.button,'--brand-contrast':palette.buttonText}))root.style.setProperty(key,value);})();`;
  return (
    <html lang="th" data-mode={dark?"dark":"light"} style={style} suppressHydrationWarning><head>{settings.mode==="auto"&&<script dangerouslySetInnerHTML={{__html:bootstrap}}/>}</head><body>
      <AuthProvider initialApplication={application?.id||'default'} initialWorkspace={access.builder?(draftId||"live"):"live"} user={user} needsSetup={needsSetup} access={access} expressionUser={application?scoped(()=>expressionUser(user)):user?{userId:user.id,userName:user.name,userRoleKey:user.role,userRole:"",userSettings:{}}:{}}><RealtimeSync/><AppSettingsProvider initialSettings={settings}><ImagePreviewProvider><AppShell>{children}</AppShell></ImagePreviewProvider></AppSettingsProvider></AuthProvider>
    </body></html>
  );
}
