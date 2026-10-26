"use client";
import {useEffect,useState} from 'react';import {clearRuntimeCache} from '@/lib/runtime-cache';
export default function WorkflowActivity({onChange}:{onChange:()=>void}) {
 const [pending,setPending]=useState(0);
 useEffect(()=>{
  let active=true,busy=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined,last:{revision:string;failed:number;pending:number}|null=null;
  const controller=new AbortController();
  const schedule=()=>{clearTimeout(timer);if(active&&document.visibilityState==='visible'&&navigator.onLine)timer=setTimeout(tick,failures?Math.min(30000,3500*2**failures):last?.pending?3500:15000);};
  async function tick(){
   clearTimeout(timer);if(!active||busy)return;
   if(document.visibilityState!=='visible'||!navigator.onLine)return;
   busy=true;
   try {
    const response=await fetch('/api/workflows?activity=1',{signal:controller.signal});
    if(!response.ok)throw Error('activity');
    const j=await response.json();failures=0;
    if(active){setPending(j.pending);if(last&&last.revision!==j.revision){clearRuntimeCache('data');onChange();if(j.failed>last.failed)window.dispatchEvent(new CustomEvent('nocode:write-status',{detail:{pending:0,state:'error',message:'งานเบื้องหลังไม่สำเร็จ กรุณาตรวจประวัติ Automation'}}));}last=j;}
   }catch{failures=Math.min(failures+1,4);}finally{busy=false;schedule();}
  }
  const wake=()=>{if(!busy)void tick();};
  const written=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.state==='saved')wake();};
  tick();window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);window.addEventListener('nocode:write-status',written);
  return()=>{active=false;controller.abort();clearTimeout(timer);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);window.removeEventListener('nocode:write-status',written);};
 },[onChange]);
 return pending?<aside className="workflow-activity" role="status">กำลังทำงานเบื้องหลัง {pending} งาน</aside>:null;
}
