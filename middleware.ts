import {NextRequest,NextResponse} from 'next/server';
import {pwaApplication,pwaBase} from './lib/pwa';
export function middleware(req:NextRequest){
 const headers=new Headers(req.headers),path=req.nextUrl.pathname,app=pwaApplication(path);headers.delete('x-nocode-route-app');headers.delete('x-nocode-pwa');headers.set('x-nocode-path',path+req.nextUrl.search);
 if(!app&&path.length>1&&path.endsWith('/'))return NextResponse.redirect(new URL(path.replace(/\/+$/,'')+req.nextUrl.search,req.url));
 if(app){const base=pwaBase(app);if(path===base.slice(0,-1))return NextResponse.redirect(new URL(base+req.nextUrl.search,req.url));const suffix=path.slice(base.length);if(!suffix||suffix==='login'){headers.set('x-nocode-pwa',app);headers.set('x-nocode-path',(suffix==='login'?'/login':'/run')+req.nextUrl.search);}}
 if(path.startsWith('/api/')){try{const ref=new URL(req.headers.get('referer')||''),loopback=(host:string)=>['localhost','127.0.0.1','[::1]'].includes(host),same=ref.origin===req.nextUrl.origin||loopback(ref.hostname)&&loopback(req.nextUrl.hostname)&&ref.protocol===req.nextUrl.protocol&&ref.port===req.nextUrl.port;const referring=same?pwaApplication(ref.pathname):null;if(referring)headers.set('x-nocode-route-app',referring);}catch{}}
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
