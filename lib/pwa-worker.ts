export function pwaWorker(base:string,version:string){return `
const BASE=${JSON.stringify(base)},CACHE='nocode-pwa:'+BASE+':'+${JSON.stringify(version)},OFFLINE=BASE+'offline';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{const response=await fetch(OFFLINE,{cache:'reload'});if(!response.ok)throw Error('Offline page unavailable');await cache.put(OFFLINE,response);} )));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('nocode-pwa:'+BASE+':')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
// Phase 1: never cache API responses, authenticated HTML, RSC, images or writes.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode!=='navigate'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE)||url.pathname.startsWith(BASE+'api/'))return;event.respondWith(fetch(event.request).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(OFFLINE)||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});}));});
`;}
