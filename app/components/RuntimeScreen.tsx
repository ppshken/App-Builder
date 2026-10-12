"use client";
import { useContext, useId, useEffect, useLayoutEffect, useRef, useState } from "react";
import {createPortal} from "react-dom";
import RuntimePageTrail,{RuntimePageStackContext} from "./RuntimePageTrail";
import Icon from "./Icon";
export default function RuntimeScreen({ title, subtitle, busy = false, onClose, children, footer, actions, className = "" }: {
  title: string; subtitle?: React.ReactNode; busy?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode; className?:string;
}) {
  const ref = useRef<HTMLElement>(null);
  const anchor=useRef<HTMLSpanElement>(null),[host,setHost]=useState<Element|null>(null);
  const child=className.includes("runtime-child-screen"),parentStack=useContext(RuntimePageStackContext),key=useId();
  const childStack=child&&parentStack?{entries:[...parentStack.entries.map(e=>({...e,current:false,disabled:e.depth!==parentStack.entries.at(-1)?.depth})),{key,title,depth:(parentStack.entries.at(-1)?.depth??-1)+1,current:true}],onClose,onSelect:()=>onClose()}:null;
  useLayoutEffect(()=>{if(child&&anchor.current)setHost(anchor.current.closest('dialog[open]')||anchor.current.closest('.runtime-route,.runtime-background')||anchor.current.closest('.runtime-app')||document.body);},[child]);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus({preventScroll:true}); return () => { if (previous?.isConnected) previous.focus({preventScroll:true}); }; }, [host]);
  const content=<section ref={ref} tabIndex={-1} className={`runtime-screen ${className}`} role="region" aria-label={title} onKeyDown={e => { if (e.key === "Escape" && !busy) { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <RuntimePageTrail closeLabel={child?"ปิดหน้ารายการลูก":undefined}/>
    <header className="runtime-screen-header"><button className="icon-button runtime-screen-back" aria-label="กลับหน้าก่อนหน้า" title="กลับหน้าก่อนหน้า" disabled={busy} onClick={onClose}><Icon name="back"/></button><div><h2 title={title}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="runtime-screen-actions">{actions}</div></header>
    <div className="runtime-screen-body">{children}</div>{footer && <footer className="runtime-screen-footer">{footer}</footer>}
  </section>;
  const screen=childStack?<RuntimePageStackContext.Provider value={childStack}>{content}</RuntimePageStackContext.Provider>:content;
  return child?<><span ref={anchor} hidden/>{host&&createPortal(screen,host)}</>:screen;
}
