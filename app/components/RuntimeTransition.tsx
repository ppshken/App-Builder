"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PageEntry} from "@/lib/runtime-page-stack";
import type {AppView} from "@/lib/views";
import AppLoading from "./AppLoading";
export type RuntimeRoute={parents?:PageEntry[];depth?:number;key:string;view:AppView;row?:number;initialValues?:Record<string,unknown>;email:string;cacheScope?:string;originView?:string;originRow?:number};
export default function RuntimeTransition({route,onCommit,render,desktop=false,backdrop}:{desktop?:boolean;backdrop?:React.ReactNode;route:RuntimeRoute;onCommit:(route:RuntimeRoute)=>void;render:(route:RuntimeRoute,active:boolean,ready:()=>void,background:boolean)=>React.ReactNode}){
 const [shown,setShown]=useState<RuntimeRoute|null>(null),latest=useRef(route.key),root=useRef<HTMLDivElement>(null);
 const [,finishMotion]=useState(0);
 const renderOrder=useRef(new Map<string,number>()),nextRenderOrder=useRef(0);
 const visited=useRef(new Set<string>()),entering=useRef<string|null>(null);
 const retained=useRef(new Map<string,RuntimeRoute>()),positions=useRef(new Map<string,number>()),screenPositions=useRef(new Map<string,number>()),scope=useRef(route.cacheScope);
 if(scope.current!==route.cacheScope){visited.current.clear();entering.current=null;retained.current.clear();renderOrder.current.clear();positions.current.clear();screenPositions.current.clear();scope.current=route.cacheScope;}
 latest.current=route.key;
 const listBehind=(entry:RuntimeRoute)=>["detail","form"].includes(entry.view.kind)?Array.from(retained.current.values()).reverse().find(list=>["list","table"].includes(list.view.kind)&&!list.row&&(entry.originView?list.view.name===entry.originView:list.view.table_name===entry.view.table_name)&&list.cacheScope===route.cacheScope):undefined;
 // Cache the scroll element when the route changes; scrolling must not query the DOM.
 const scrollTarget=useRef<{key:string;positionKey:string;host:HTMLElement|null;body:HTMLElement|null}|null>(null);
 const recordPosition=()=>{const target=scrollTarget.current;if(target&&latest.current===target.key){positions.current.set(target.positionKey,target.host?target.host.scrollTop:window.scrollY);if(target.body)screenPositions.current.set(target.key,target.body.scrollTop);}};
 useEffect(()=>{const record=recordPosition,host=scrollTarget.current?.host||window;host.addEventListener("scroll",record,{passive:true});return()=>host.removeEventListener("scroll",record);},[shown?.key,desktop]);
 useLayoutEffect(()=>{if(!shown)return;const previousList=listBehind(shown);scrollTarget.current={key:shown.key,positionKey:previousList?.key||shown.key,host:desktop?null:root.current?.closest<HTMLElement>(".runtime-app > main")||null,body:root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen-body')||null};const top=positions.current.get(previousList?.key||shown.key)||0;// Do not issue redundant document scrolls: mobile browser chrome reacts to them.
 const host=scrollTarget.current.host;
 if(host){if(Math.abs(host.scrollTop-top)>1)host.scrollTop=top;}
 else if(Math.abs(window.scrollY-top)>1)window.scrollTo({top,behavior:"instant" as ScrollBehavior});
 const body=scrollTarget.current.body,bodyTop=screenPositions.current.get(shown.key)||0;
 if(body&&Math.abs(body.scrollTop-bodyTop)>1)body.scrollTop=bodyTop;},[shown?.key,desktop]);
 const pending=shown?.key!==route.key;
 if(shown&&["list","table","detail"].includes(shown.view.kind)&&shown.cacheScope===route.cacheScope){retained.current.delete(shown.key);retained.current.set(shown.key,shown);const pinned=new Set([shown.key,listBehind(shown)?.key]);while(retained.current.size>(desktop?16:4)){const victim=[...retained.current.keys()].find(key=>!pinned.has(key));if(!victim)break;retained.current.delete(victim);}}
 const entries=Array.from(new Map([...retained.current,...(pending&&shown?[[shown.key,shown] as const]:[]),[route.key,route] as const]).values());
 // Cache recency must never reorder mounted DOM: Safari may repaint the entire retained list.
 const mountedKeys=new Set(entries.map(entry=>entry.key));for(const key of renderOrder.current.keys())if(!mountedKeys.has(key))renderOrder.current.delete(key);
 for(const entry of entries)if(!renderOrder.current.has(entry.key))renderOrder.current.set(entry.key,nextRenderOrder.current++);
 entries.sort((a,b)=>(a.depth??0)-(b.depth??0)||renderOrder.current.get(a.key)!-renderOrder.current.get(b.key)!);
 // Restore an already mounted route before paint, rather than waiting for its ready effect.
 useLayoutEffect(()=>{if(shown?.key===route.key)return;const cached=retained.current.get(route.key);if(!cached||cached.cacheScope!==route.cacheScope)return;entering.current=shown&&!shown.row&&!["detail","form"].includes(shown.view.kind)?cached.key:null;const restored={...cached,parents:route.parents};setShown(restored);onCommit(restored);},[route.key,route.cacheScope,shown?.key,onCommit]);
 const detailOpen=shown&&["detail","form"].includes(shown.view.kind);
 // A lower history depth can belong to another menu; only real ancestors may show underneath.
 const parentScreen=!desktop&&detailOpen?entries.filter(entry=>entry.key!==shown.key&&shown.parents?.some(parent=>parent.view===entry.view.name&&parent.row===entry.row&&parent.depth===entry.depth)&&!!entry.row&&["detail","form"].includes(entry.view.kind)&&entry.cacheScope===route.cacheScope).sort((a,b)=>(b.depth??0)-(a.depth??0))[0]:undefined;
 const background=parentScreen||(detailOpen?entries.slice().reverse().find(entry=>entry.key!==shown.key&&!entry.row&&["list","table"].includes(entry.view.kind)&&(shown.originView?entry.view.name===shown.originView:entry.view.table_name===shown.view.table_name)&&entry.cacheScope===route.cacheScope):undefined);
 return <div ref={root} className="runtime-transition" onAnimationEnd={event=>{if(event.animationName==='runtime-data-page-in'&&!(event.target as HTMLElement).classList.contains('runtime-child-screen')&&entering.current){entering.current=null;finishMotion(n=>n+1);}}} aria-busy={pending} onScrollCapture={recordPosition} onPointerDownCapture={recordPosition} onClickCapture={recordPosition} onKeyDownCapture={recordPosition}>{detailOpen&&!background&&backdrop}{entries.map(entry=>{const active=shown?.key===entry.key,isBackground=background?.key===entry.key;return <div key={entry.key} data-motion={active&&entering.current===entry.key?"forward":undefined} className={isBackground?(desktop?"runtime-background desktop-detail-backdrop":"runtime-background runtime-mobile-backdrop"):"runtime-route"} aria-hidden={isBackground&&!desktop?true:undefined} hidden={!active&&!isBackground} ref={el=>{if(el)el.inert=pending&&active||isBackground&&!desktop;}}>
  {render(entry,active,()=>{if(latest.current!==entry.key||shown?.key===entry.key)return;entering.current=shown&&(!visited.current.has(entry.key)||!shown.row&&!["detail","form"].includes(shown.view.kind))?entry.key:null;visited.current.add(entry.key);if(visited.current.size>64)visited.current.delete(visited.current.values().next().value!);setShown(entry);onCommit(entry);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('.runtime-route:not([hidden]) .runtime-screen')?.focus({preventScroll:true}));},isBackground)}
 </div>;})}{pending&&(!shown||!retained.current.has(route.key))&&<div className={shown?"runtime-navigation-loading":"runtime-first-loading"}><AppLoading compact={!!shown}/></div>}</div>;
}
