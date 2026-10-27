/** Public URL helpers; safe to import from middleware and client components. */
export function pwaApplication(path:string){return /^\/app\/(default|a_[a-f0-9]{24})(?:\/|$)/.exec(path)?.[1]||null;}
export const pwaBase=(id:string)=>'/app/'+id+'/';
/** Preserve app identity for media/new-tab links even when noreferrer removes the page context. */
export function appResourceUrl(value:string,app:string){if(!/^\/api\/(files|images)\/[a-zA-Z0-9-]+(?:[?#]|$)/.test(value)||!pwaApplication(pwaBase(app)))return value;const url=new URL(value,'https://local.invalid');url.searchParams.set('pwa_app',app);return url.pathname+url.search+url.hash;}
export function runtimePath(path=typeof location==='undefined'?'':location.pathname){const app=pwaApplication(path);return app?pwaBase(app):'/run';}
export function runtimeLogin(path=typeof location==='undefined'?'':location.pathname){const app=pwaApplication(path);return app?pwaBase(app)+'login':'/login';}
export function scopedApi(path:string,current=typeof location==='undefined'?'':location.pathname){const app=pwaApplication(current);return app&&path.startsWith('/api/realtime?')?path+'&pwa=1':path;}
export function pwaManifest(id:string,name:string,color:string){const base=pwaBase(id);return {id:base,name,short_name:name.slice(0,30),lang:'th',start_url:base,scope:base,display:'standalone',background_color:'#ffffff',theme_color:color,icons:[192,512].map(size=>({src:base+'icon/'+size,sizes:size+'x'+size,type:'image/png',purpose:'any maskable'}))};}
