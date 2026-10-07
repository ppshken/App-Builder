"use client";
import {useEffect,useRef,useState} from "react";
import type {AppView} from "@/lib/views";
import AppLoading from "./AppLoading";
export type RuntimeRoute={key:string;view:AppView;row?:number;initialValues?:Record<string,unknown>;email:string};
export default function RuntimeTransition({route,onCommit,render}:{route:RuntimeRoute;onCommit:(route:RuntimeRoute)=>void;render:(route:RuntimeRoute,active:boolean,ready:()=>void)=>React.ReactNode}){
 const [shown,setShown]=useState<RuntimeRoute|null>(null),[waiting,setWaiting]=useState(false),latest=useRef(route.key),root=useRef<HTMLDivElement>(null);
 latest.current=route.key;
 const pending=shown?.key!==route.key;
 useEffect(()=>{setWaiting(false);if(!pending)return;const timer=setTimeout(()=>setWaiting(true),180);return()=>clearTimeout(timer);},[route.key,pending]);
 const entries=pending?[...(shown?[shown]:[]),route]:[route];
 return <div ref={root} className="runtime-transition" aria-busy={pending}>{entries.map(entry=>{const active=shown?.key===entry.key;return <div key={entry.key} className="runtime-route" hidden={!active} ref={el=>{if(el)el.inert=pending&&active;}}>
  {render(entry,active,()=>{if(latest.current!==entry.key||shown?.key===entry.key)return;setShown(entry);onCommit(entry);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen')?.focus({preventScroll:true}));})}
 </div>;})}{pending&&(!shown||waiting)&&<div className={shown?"runtime-navigation-loading":"runtime-first-loading"}><AppLoading compact={!!shown}/></div>}</div>;
}
