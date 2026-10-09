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
import ImagePreviewProvider from "./components/ImagePreviewProvider";
import AppShell from "./components/AppShell";
import AppSettingsProvider from "./components/AppSettingsProvider";
export const metadata = { title: "No-code Builder" };
export default async function Root({ children }: { children: React.ReactNode }) {
  const path=headers().get("x-nocode-path") || "/", user=sessionUser(cookies().get(SESSION_COOKIE)?.value || ""), needsSetup=!ownerExists();
  if(path.split("?")[0]!=="/login"&&!user)redirect("/login?next="+encodeURIComponent(path));
  const access=user?accessFor(user):NO_ACCESS, page=path.split("?")[0];
  if(page==="/login"&&user)redirect(landingPage(user));
  if(user&&page!=="/login"&&page!=="/run"&&(!access.builder||((page==="/users"||page==="/backups"||page==="/audit-log"||page==="/workflows")&&!access.owner)))redirect("/run");
  const settings=readAppSettings(!user),dark=settings.mode==="dark",colors=themeColors(settings,dark);
  const style={"--accent":colors.accent,"--accent-soft":colors.soft,"--brand-color":colors.button,"--brand-contrast":colors.buttonText,"--app-font-family":fontFamily(settings.font),"--app-font-weight":String(settings.font_weight),"--font-scale":String(settings.font_size/14)} as CSSProperties;
  const palettes=JSON.stringify({light:themeColors(settings,false),dark:themeColors(settings,true)}).replace(/</g,"\\u003c");
  const bootstrap=`(()=>{const root=document.documentElement,dark=matchMedia('(prefers-color-scheme:dark)').matches,palette=(${palettes})[dark?'dark':'light'];root.dataset.mode=dark?'dark':'light';for(const [key,value] of Object.entries({'--accent':palette.accent,'--accent-soft':palette.soft,'--brand-color':palette.button,'--brand-contrast':palette.buttonText}))root.style.setProperty(key,value);})();`;
  return (
    <html lang="th" data-mode={dark?"dark":"light"} style={style} suppressHydrationWarning><head>{settings.mode==="auto"&&<script dangerouslySetInnerHTML={{__html:bootstrap}}/>}</head><body>
      <AuthProvider user={user} needsSetup={needsSetup} access={access} expressionUser={expressionUser(user)}><AppSettingsProvider initialSettings={settings}><ImagePreviewProvider><AppShell>{children}</AppShell></ImagePreviewProvider></AppSettingsProvider></AuthProvider>
    </body></html>
  );
}
