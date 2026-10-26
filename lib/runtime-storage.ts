// Optional, bounded read cache. A failed/blocked IndexedDB never blocks the app.
const DB_NAME='nocode-runtime-cache-v1',STORE='reads';
let opening:Promise<IDBDatabase|null>|undefined,queue:Promise<unknown>=Promise.resolve();
function database():Promise<IDBDatabase|null>{
 if(typeof indexedDB==='undefined')return Promise.resolve(null);
 if(opening)return opening;
 opening=new Promise(resolve=>{let settled=false;const finish=(db:IDBDatabase|null)=>{if(settled){db?.close();return;}settled=true;clearTimeout(timeout);resolve(db);};const timeout=setTimeout(()=>finish(null),100);
 try{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore(STORE,{keyPath:'key'});store.createIndex('expires','expires');};request.onerror=()=>finish(null);request.onblocked=()=>finish(null);request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opening=undefined;};finish(request.result);};}catch{finish(null);}
 });return opening;
}
function serial<T>(run:()=>Promise<T>):Promise<T>{const next=queue.then(run,run);queue=next.catch(()=>{});return next;}
export function readStoredRuntime(scope:string,key:string):Promise<any|undefined>{return serial(async()=>{const db=await database();if(!db)return;return new Promise(resolve=>{try{const request=db.transaction(STORE).objectStore(STORE).get(JSON.stringify([scope,key]));request.onsuccess=()=>resolve(request.result?.expires>Date.now()?request.result.value:undefined);request.onerror=()=>resolve(undefined);}catch{resolve(undefined);}});});}
export function storeRuntime(scope:string,key:string,value:unknown,expires:number):Promise<void>{return serial(async()=>{
 try{if(JSON.stringify(value).length>250000)return;}catch{return;}
 const db=await database();if(!db)return;
 await new Promise<void>(resolve=>{try{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);store.put({key:JSON.stringify([scope,key]),value,expires});const count=store.count();count.onsuccess=()=>{let remove=Math.max(0,count.result-100);const cursor=store.index('expires').openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;if(item.value.expires<=Date.now()||remove>0){item.delete();remove=Math.max(0,remove-1);item.continue();}};};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});
 });}
export function clearStoredRuntime():Promise<void>{return serial(async()=>{const db=await database();if(!db)return;await new Promise<void>(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});});}
