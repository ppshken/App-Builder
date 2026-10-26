import {readStoredRuntime,storeRuntime,clearStoredRuntime} from "./runtime-storage";
// Browser-local shared reads: also deduplicate overlapping transition/StrictMode mounts.
let storageScope="",generation=0;
export function configureRuntimeStorage(scope:string){if(storageScope!==scope){storageScope=scope;entries.clear();recordSnapshots.clear();generation++;}}
export function invalidateRuntimeStorage(){generation++;return clearStoredRuntime();}
const entries = new Map<string, { expires: number; promise: Promise<any> }>();
const recordSnapshots=new Map<string,{row:any;expires:number}>();
export function rememberRuntimeRow(table:string,row:any,email:string,slice="") {
 const key=JSON.stringify([table,row.id,email,slice]);
 recordSnapshots.delete(key);recordSnapshots.set(key,{row,expires:Date.now()+30000});
 while(recordSnapshots.size>50)recordSnapshots.delete(recordSnapshots.keys().next().value!);
}
export function runtimeRowSnapshot(table:string,id:number,email:string,slice="") {
 const key=JSON.stringify([table,id,email,slice]),entry=recordSnapshots.get(key);
 if(!entry||entry.expires<Date.now()){recordSnapshots.delete(key);return undefined;}return entry.row;
}
export function publishRuntimeRow(table:string,id:number,email:string,row?:any) {
 if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("nocode:row-change",{detail:{table,id,email,row}}));
}
export function clearRuntimeCache(scope: "all" | "data" = "all") {
  recordSnapshots.clear();invalidateRuntimeStorage();
  if (scope === "all") { entries.clear(); return; }
  for (const key of entries.keys()) {
    const [url] = JSON.parse(key) as [string,string];
    if (url.startsWith("/api/view-data/") || url.startsWith("/api/data/") || url.startsWith("/api/expression-data") || url === "/api/views?runtime=1") entries.delete(key);
  }
}
export function runtimeJSON(url: string, email = "", maxAge = 60000): Promise<any> {
  const key = JSON.stringify([url, email]);
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Infinity, promise: Promise.resolve() as Promise<any> };
  const epoch=generation,scope=storageScope;
  const persistent=!!scope&&maxAge>0&&/^\/api\/(?:data\/|view-data\/|expression-data)/.test(url);
  const network=()=>fetch(url, {headers: {"x-nocode-preview-email": email}}).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่ได้ กรุณาลองใหม่");
    entry.expires = Date.now() + maxAge;
    if(persistent&&epoch===generation&&scope===storageScope)void storeRuntime(scope,key,data,Date.now()+Math.min(maxAge,15000));
    return data;
  });
  entry.promise = (async()=>{if(persistent){const stored=await readStoredRuntime(scope,key);if(stored!==undefined&&epoch===generation&&scope===storageScope){entry.expires=Date.now()+1000;return stored;}}return network();})().catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
  if (entries.size >= 100) entries.delete(entries.keys().next().value!);
  entries.set(key, entry);
  return entry.promise;
}
if (typeof window !== "undefined") window.addEventListener("nocode:metadata", () => clearRuntimeCache());
