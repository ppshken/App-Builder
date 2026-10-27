// Bounded, process-local API counters. No request bodies, user IDs or URLs are retained.
export type RequestCounts={requests:number;errors:number;reads:number;writes:number;duration_ms:number};
export type RequestGroup=RequestCounts&{app_id:string|null;table:string|null};
export type TrafficBucket={at:number;total:RequestCounts;groups:RequestGroup[]};
type Bucket={at:number;total:RequestCounts;groups:Map<string,RequestGroup>};
type Store={started_at:number;active:number;buckets:Bucket[];limited:boolean};
const globalState=globalThis as typeof globalThis&{__nocodeSystemMetrics?:Store};
const empty=():RequestCounts=>({requests:0,errors:0,reads:0,writes:0,duration_ms:0});
const store=()=>globalState.__nocodeSystemMetrics??={started_at:Date.now(),active:0,buckets:[],limited:false};
function add(counts:RequestCounts,status:number,read:boolean,ms:number){counts.requests++;counts.errors+=Number(status>=400);counts[read?'reads':'writes']++;counts.duration_ms+=ms;}
export function beginSystemRequest(appId:string|null,table:string|null,method:string){const state=store(),start=performance.now();state.active++;let ended=false;return (status:number)=>{if(ended)return;ended=true;state.active=Math.max(0,state.active-1);const now=Date.now(),at=Math.floor(now/60000)*60000;state.buckets=state.buckets.filter(b=>b.at>=at-59*60000);let bucket=state.buckets.find(b=>b.at===at);if(!bucket){bucket={at,total:empty(),groups:new Map()};state.buckets.push(bucket);}const read=['GET','HEAD'].includes(method),ms=Math.max(0,performance.now()-start);add(bucket.total,status,read,ms);const key=JSON.stringify([appId,table]);let group=bucket.groups.get(key);if(!group&&bucket.groups.size<500){group={app_id:appId,table,...empty()};bucket.groups.set(key,group);}if(group)add(group,status,read,ms);else state.limited=true;};}
export function systemTraffic(now=Date.now()){const state=store(),at=Math.floor(now/60000)*60000;state.buckets=state.buckets.filter(b=>b.at>=at-59*60000);return {started_at:state.started_at,active_requests:state.active,limited:state.limited,scope:'current_process' as const,buckets:Array.from({length:60},(_,i)=>{const time=at-(59-i)*60000,b=state.buckets.find(b=>b.at===time);return {at:time,total:b?{...b.total}:empty(),groups:b?Array.from(b.groups.values(),g=>({...g})):[]};})};}
