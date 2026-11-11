// One bounded, serialized background refresh; invalidations during a read get one trailing read.
export function createRefreshQueue(run:()=>Promise<unknown>,delay=300,maxWait=1000,minInterval=0){
 let active=true,disposed=false,dirty=false,running=false,first=0,lastStarted=0,timer:ReturnType<typeof setTimeout>|undefined;
 const clear=()=>{clearTimeout(timer);timer=undefined;};
 const schedule=()=>{clear();if(disposed||!active||!dirty||running)return;timer=setTimeout(drain,Math.max(0,Math.min(delay,maxWait-(Date.now()-first)),minInterval-(Date.now()-lastStarted)));};
 async function drain(){timer=undefined;if(disposed||!active||running||!dirty)return;dirty=false;first=0;running=true;lastStarted=Date.now();try{await run();}catch{/* Callers display request failures. */}finally{running=false;if(!disposed)schedule();}}
 return {invalidate(){if(disposed)return;if(!dirty)first=Date.now();dirty=true;schedule();},setActive(value:boolean){active=value;if(active)schedule();else clear();},dispose(){disposed=true;dirty=false;clear();}};
}
export function realtimeVersionsCovered(tables:string[],versions:Record<string,string>|undefined,known:Record<string,string>){return !!versions&&tables.length>0&&tables.every(table=>typeof versions[table]==='string'&&versions[table]===known[table]);}
