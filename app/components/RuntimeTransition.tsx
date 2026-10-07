"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {AppView} from "@/lib/views";
import AppLoading from "./AppLoading";
export type RuntimeRoute={key:string;view:AppView;row?:number;initialValues?:Record<string,unknown>;email:string;cacheScope?:string};
export default function RuntimeTransition({route,onCommit,render,desktop=false,backdrop}:{desktop?:boolean;backdrop?:React.ReactNode;route:RuntimeRoute;onCommit:(route:RuntimeRoute)=>void;render:(route:RuntimeRoute,active:boolean,ready:()=>void)=>React.ReactNode}){
 const [shown,setShown]=useState<RuntimeRoute|null>(null),[waiting,setWaiting]=useState(false),latest=useRef(route.key),root=useRef<HTMLDivElement>(null);
 const retained=useRef(new Map<string,RuntimeRoute>()),positions=useRef(new Map<string,number>()),screenPositions=useRef(new Map<string,number>()),scope=useRef(route.cacheScope);
 if(scope.current!==route.cacheScope){retained.current.clear();positions.current.clear();screenPositions.current.clear();scope.current=route.cacheScope;}
 latest.current=route.key;
 const listBehind=(entry:RuntimeRoute)=>desktop&&["detail","form"].includes(entry.view.kind)?Array.from(retained.current.values()).reverse().find(list=>["list","table"].includes(list.view.kind)&&!list.row&&list.view.table_name===entry.view.table_name&&list.cacheScope===route.cacheScope):undefined;
 const recordPosition=()=>{if(shown&&latest.current===shown.key){positions.current.set(listBehind(shown)?.key||shown.key,window.scrollY);const body=root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen-body');if(body)screenPositions.current.set(shown.key,body.scrollTop);}};
 useEffect(()=>{const record=recordPosition;window.addEventListener("scroll",record,{passive:true});return()=>window.removeEventListener("scroll",record);},[shown?.key,desktop]);
 useLayoutEffect(()=>{if(!shown)return;const previousList=listBehind(shown);const top=positions.current.get(previousList?.key||shown.key)||0;const restore=()=>{window.scrollTo({top,behavior:"instant" as ScrollBehavior});const body=root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen-body');if(body)body.scrollTop=screenPositions.current.get(shown.key)||0;};restore();const frame=requestAnimationFrame(restore);return()=>cancelAnimationFrame(frame);},[shown?.key]);
 const pending=shown?.key!==route.key;
 useEffect(()=>{setWaiting(false);if(!pending)return;const timer=setTimeout(()=>setWaiting(true),180);return()=>clearTimeout(timer);},[route.key,pending]);
 if(shown&&["list","table","detail"].includes(shown.view.kind)&&shown.cacheScope===route.cacheScope){retained.current.set(shown.key,shown);while(retained.current.size>16)retained.current.delete(retained.current.keys().next().value!);}
 const entries=Array.from(new Map([...retained.current,...(pending&&shown?[[shown.key,shown] as const]:[]),[route.key,route] as const]).values());
 const detailOpen=desktop&&shown&&["detail","form"].includes(shown.view.kind);
 const background=detailOpen?entries.slice().reverse().find(entry=>entry.key!==shown.key&&!entry.row&&["list","table"].includes(entry.view.kind)&&entry.view.table_name===shown.view.table_name&&entry.cacheScope===route.cacheScope):undefined;
 return <div ref={root} className="runtime-transition" aria-busy={pending} onScrollCapture={recordPosition} onPointerDownCapture={recordPosition} onClickCapture={recordPosition} onKeyDownCapture={recordPosition}>{detailOpen&&!background&&backdrop}{entries.map(entry=>{const active=shown?.key===entry.key,isBackground=background?.key===entry.key;return <div key={entry.key} className={isBackground?"runtime-background desktop-detail-backdrop":"runtime-route"} hidden={!active&&!isBackground} ref={el=>{if(el)el.inert=pending&&active;}}>
  {render(entry,active,()=>{if(latest.current!==entry.key||shown?.key===entry.key)return;setShown(entry);onCommit(entry);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen')?.focus({preventScroll:true}));})}
 </div>;})}{pending&&(!shown||waiting)&&<div className={shown?"runtime-navigation-loading":"runtime-first-loading"}><AppLoading compact={!!shown}/></div>}</div>;
}
