"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
export type NavigationGuard=(proceed?:()=>void)=>boolean;
export default function useRuntimeExit({disabled=false,guard,holdUntilHidden}:{disabled?:boolean;guard?:NavigationGuard;holdUntilHidden?:RefObject<HTMLElement>}={}) {
 const [closing,setClosing]=useState(false),locked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>();
 const latest=useRef({disabled,guard});latest.current={disabled,guard};
 const reset=()=>{locked.current=false;setClosing(false);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{if(!closing||!holdUntilHidden?.current)return;const route=holdUntilHidden.current.closest('.runtime-route,.runtime-background');if(!route)return;const check=()=>{if(route.hasAttribute('hidden')||route.classList.contains('runtime-background'))reset();};const observer=new MutationObserver(check);observer.observe(route,{attributes:true,attributeFilter:['hidden','class']});check();return()=>observer.disconnect();},[closing,holdUntilHidden]);
 const request=(run:()=>void)=>{
  if(latest.current.disabled||locked.current)return;
  if(latest.current.guard&&!latest.current.guard(()=>request(run)))return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){run();return;}
  locked.current=true;setClosing(true);
  const duration=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--runtime-exit-duration'))||180;
  timer.current=setTimeout(()=>{
   if(latest.current.disabled){reset();return;}
   if(latest.current.guard&&!latest.current.guard(()=>request(run))){reset();return;}
   try{run();}finally{if(!holdUntilHidden?.current?.closest('.runtime-route,.runtime-background'))reset();}
  },duration);
 };
 return {closing,request};
}
