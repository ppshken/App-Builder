"use client";
import { useContext, useId, useEffect, useLayoutEffect, useRef, useState } from "react";
import {createPortal} from "react-dom";
import {RuntimeNestedGuards} from "./RuntimeNestedGuards";
import {RuntimeHeaderHost,registerRuntimeHeader} from "./RuntimeHeaderHost";
import RuntimePageTrail,{RuntimePageStackContext} from "./RuntimePageTrail";
import Icon from "./Icon";
import useRuntimeExit,{type NavigationGuard} from "./useRuntimeExit";
import RuntimeCloseButton,{RuntimeCloseContext} from "./RuntimeCloseButton";
export default function RuntimeScreen({ title, subtitle, busy = false, onClose, children, footer, actions, canLeave, consolidateHeader = false, className = "" }: {
  title: string; subtitle?: React.ReactNode; busy?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode; canLeave?:NavigationGuard; consolidateHeader?:boolean; className?:string;
}) {
  const ref = useRef<HTMLElement>(null),headerHost=useContext(RuntimeHeaderHost);
  const registerNestedGuard=useContext(RuntimeNestedGuards),latestGuard=useRef({busy,canLeave,onClose});latestGuard.current={busy,canLeave,onClose};
  const [ownsHeader,setOwnsHeader]=useState(false);
  const {closing,request}=useRuntimeExit({disabled:busy,guard:canLeave,holdUntilHidden:ref});
  const anchor=useRef<HTMLSpanElement>(null),[host,setHost]=useState<Element|null>(null);
  const child=className.includes("runtime-child-screen"),parentStack=useContext(RuntimePageStackContext),key=useId();
  const [entering,setEntering]=useState(true);
  useEffect(()=>{const timer=setTimeout(()=>setEntering(false),220);return()=>clearTimeout(timer);},[host]);
  const childStack=child&&parentStack?{breadcrumb:parentStack.breadcrumb,entries:[...parentStack.entries.map(e=>({...e,current:false,disabled:e.depth!==parentStack.entries.at(-1)?.depth})),{key,title,depth:(parentStack.entries.at(-1)?.depth??-1)+1,current:true}],onClose,onSelect:()=>onClose()}:null;
  useLayoutEffect(()=>{if(child&&anchor.current)setHost(anchor.current.closest('dialog[open]')||anchor.current.closest('.runtime-route,.runtime-background')||anchor.current.closest('.runtime-app')||document.body);},[child]);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus({preventScroll:true}); return () => { if (previous?.isConnected && !previous.closest("[hidden],[inert],[aria-hidden=\"true\"]") && previous.getClientRects().length) previous.focus({preventScroll:true}); }; }, [host]);
  useLayoutEffect(()=>{const app=headerHost?.closest('.runtime-app')||ref.current?.closest('.runtime-app'),screen=ref.current;if(!app||!screen)return;return registerRuntimeHeader(app,screen,owns=>{setOwnsHeader(owns);screen.inert=!owns;if(owns)screen.removeAttribute('aria-hidden');else screen.setAttribute('aria-hidden','true');});},[headerHost,host]);
  useLayoutEffect(()=>{if(!child||!registerNestedGuard||!ref.current)return;return registerNestedGuard(ref.current,proceed=>!latestGuard.current.busy&&(latestGuard.current.canLeave?.(proceed)??true));},[child,host,registerNestedGuard]);
  // Retained parent routes must not resurrect a child editor after leaving them.
  useLayoutEffect(()=>{if(!child||!ref.current)return;const route=ref.current.closest<HTMLElement>('.runtime-route');if(!route)return;let visible=!route.hidden;const check=()=>{if(!route.hidden)visible=true;else if(visible){visible=false;latestGuard.current.onClose();}};const observer=new MutationObserver(check);observer.observe(route,{attributes:true,attributeFilter:['hidden']});return()=>observer.disconnect();},[child,host]);
  const mobileHeader=<div className="runtime-mobile-page-header"><RuntimeCloseButton className="icon-button" aria-label="กลับหน้าก่อนหน้า" title="กลับหน้าก่อนหน้า" disabled={busy} onClose={onClose}><Icon name="back"/></RuntimeCloseButton><h2 title={title}>{title}</h2>{actions&&<div className="runtime-mobile-page-actions" aria-label="การทำงานของข้อมูล">{actions}</div>}</div>;
  const mergedHeader=consolidateHeader&&!!(childStack||parentStack)?.breadcrumb;
  const content=<section ref={ref} tabIndex={-1} className={`runtime-screen ${className}`} role="region" data-closing={closing||undefined} data-screen-enter={child&&entering||undefined} aria-label={title} onKeyDown={e => { if (e.key === "Escape" && !busy) { e.preventDefault(); e.stopPropagation(); request(onClose); } }}>
    {!headerHost&&mobileHeader}
    <RuntimePageTrail actions={mergedHeader?(actions||<RuntimeCloseButton className="icon-button" aria-label="ปิดหน้าฟอร์ม" title="ปิดหน้าฟอร์ม" disabled={busy} onClose={onClose}><Icon name="close"/></RuntimeCloseButton>):undefined} closeLabel={child?"ปิดหน้ารายการลูก":undefined}/>
    {!mergedHeader&&<header className="runtime-screen-header"><RuntimeCloseButton className="icon-button runtime-screen-back" aria-label="กลับหน้าก่อนหน้า" title="กลับหน้าก่อนหน้า" disabled={busy} onClose={onClose}><Icon name="back"/></RuntimeCloseButton><div><h2 title={title}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="runtime-screen-actions">{actions}</div></header>}
    <div className="runtime-screen-body">{children}</div>{footer && <footer className="runtime-screen-footer">{footer}</footer>}
  </section>;
  const interactive=<RuntimeCloseContext.Provider value={request}>{content}{headerHost&&ownsHeader&&createPortal(mobileHeader,headerHost)}</RuntimeCloseContext.Provider>;
  const screen=childStack?<RuntimePageStackContext.Provider value={childStack}>{interactive}</RuntimePageStackContext.Provider>:interactive;
  return child?<><span ref={anchor} hidden/>{host&&createPortal(screen,host)}</>:screen;
}
