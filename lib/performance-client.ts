import {createUuid} from './uuid';
export type Timing={kind:'api'|'image'|'longtask';name:string;ms:number;bytes:number;status:number|null};
export type PerformanceRun={id:string;label:string;at:string;duration_ms:number;events:Timing[];server?:any;frames?:{count:number;over50ms:number;max_ms:number}};
let scope='',active=false,started=0,label='',events:Timing[]=[],runs:PerformanceRun[]=[],frames={count:0,over50ms:0,max_ms:0};
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('nocode:performance'));};
const key=()=> 'nocode:performance:'+scope;
function persist(){try{localStorage.setItem(key(),JSON.stringify(runs));}catch{}}
export function configurePerformance(next:string){if(scope===next)return;scope=next;active=false;events=[];runs=[];try{const value=JSON.parse(localStorage.getItem(key())||'[]');if(Array.isArray(value))runs=value.filter(r=>r&&typeof r.id==='string'&&Array.isArray(r.events)).slice(0,10);}catch{}changed();}
export function reloadPerformanceRuns(){try{const value=JSON.parse(localStorage.getItem(key())||'[]');runs=Array.isArray(value)?value.filter(r=>r&&typeof r.id==='string'&&typeof r.label==='string'&&Array.isArray(r.events)).slice(0,10):[];}catch{runs=[];}changed();}
export function performanceState(){return {active,runs,started};}
export function startPerformance(name:string){label=name.trim().slice(0,80)||'การใช้งาน';events=[];frames={count:0,over50ms:0,max_ms:0};started=performance.now();active=true;changed();}
export function addPerformanceTiming(item:Timing){if(active&&events.length<500&&Number.isFinite(item.ms))events.push(item);}
export function addPerformanceFrame(ms:number){if(!active)return;frames.count++;frames.max_ms=Math.max(frames.max_ms,ms);if(ms>50)frames.over50ms++;}
export function savePerformanceRun(run:PerformanceRun){runs=[run,...runs].slice(0,10);persist();changed();}
export function stopPerformance(){if(!active)return;active=false;savePerformanceRun({id:createUuid(),label,at:new Date().toISOString(),duration_ms:performance.now()-started,events:[...events],frames:{...frames}});}
export function saveServerPerformance(server:any,name:string){savePerformanceRun({id:createUuid(),label:name.trim().slice(0,80)||server.label,at:new Date().toISOString(),duration_ms:server.total_ms,events:[],server});}
export function clearPerformanceRuns(){runs=[];persist();changed();}
export function timingPercentile(events:Timing[],kind:Timing['kind']){const values=events.filter(e=>e.kind===kind).map(e=>e.ms).sort((a,b)=>a-b);return values.length?values[Math.ceil(values.length*.95)-1]:null;}
