"use client";
import {useEffect,useState} from 'react';
import {configurePerformance,reloadPerformanceRuns,performanceState,addPerformanceTiming,addPerformanceFrame,stopPerformance} from '@/lib/performance-client';
export default function PerformanceRecorder({scope}:{scope:string}){
 const [active,setActive]=useState(false);
 useEffect(()=>{configurePerformance(scope);const sync=()=>setActive(performanceState().active);sync();const storage=(e:StorageEvent)=>{if(e.key==='nocode:performance:'+scope)reloadPerformanceRuns();};window.addEventListener('storage',storage);window.addEventListener('nocode:performance',sync);return()=>{window.removeEventListener('storage',storage);window.removeEventListener('nocode:performance',sync);};},[scope]);
 useEffect(()=>{if(!active||!scope)return;let previous=performance.now(),frame=0;const visibility=()=>{previous=performance.now();};document.addEventListener('visibilitychange',visibility);const started=performanceState().started;
  const tick=(now:number)=>{if(document.visibilityState==='visible')addPerformanceFrame(now-previous);previous=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  let observer:PerformanceObserver|undefined;
  if(typeof PerformanceObserver!=='undefined'){observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.startTime<started)continue;if(entry.entryType==='longtask'){addPerformanceTiming({kind:'longtask',name:'งานบนหน้าจอ',ms:entry.duration,bytes:0,status:null});continue;}
   const r=entry as PerformanceResourceTiming;let url:URL;try{url=new URL(r.name);}catch{continue;}const kind=r.initiatorType==='img'?'image':url.origin===location.origin&&url.pathname.startsWith('/api/')?'api':null;if(!kind)continue;
   const name=url.origin===location.origin?url.pathname.replace(/\/[0-9a-f-]{20,}(?=\/|$)/gi,'/[id]'):url.hostname+'/…';
   addPerformanceTiming({kind,name,ms:r.duration,bytes:r.transferSize||0,status:(r as any).responseStatus||null});
  }});try{observer.observe({entryTypes:['resource',...(PerformanceObserver.supportedEntryTypes.includes('longtask')?['longtask']:[])]});}catch{observer.disconnect();}}
  window.addEventListener('pagehide',stopPerformance);
  const timeout=setTimeout(stopPerformance,60000);return()=>{cancelAnimationFrame(frame);window.removeEventListener('pagehide',stopPerformance);document.removeEventListener('visibilitychange',visibility);observer?.disconnect();clearTimeout(timeout);};
 },[active,scope]);
 return active?<aside className="performance-recording" role="status"><span>กำลังวัดประสิทธิภาพ · สูงสุด 60 วินาที</span><button type="button" onClick={stopPerformance}>หยุดวัด</button></aside>:null;
}
