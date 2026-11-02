import {requestOrigin,sameRequestOrigin} from './lib/request-origin';
import {NextRequest,NextResponse} from 'next/server';
import {pwaApplication,pwaBase} from './lib/pwa';
export function proxy(req:NextRequest){
 const headers=new Headers(req.headers),path=req.nextUrl.pathname,app=pwaApplication(path);headers.delete('x-nocode-route-app');headers.delete('x-nocode-pwa');headers.set('x-nocode-path',path+req.nextUrl.search);
 if(!app&&path.length>1&&path.endsWith('/'))return NextResponse.redirect(new URL(path.replace(/\/+$/,'')+req.nextUrl.search,requestOrigin(req)));
 if(app){const base=pwaBase(app);if(path===base.slice(0,-1))return NextResponse.redirect(new URL(base+req.nextUrl.search,requestOrigin(req)));const suffix=path.slice(base.length);if(!suffix||suffix==='login'){headers.set('x-nocode-pwa',app);headers.set('x-nocode-path',(suffix==='login'?'/login':'/run')+req.nextUrl.search);}}
 if(path.startsWith('/api/')){try{const ref=new URL(req.headers.get('referer')||''),same=sameRequestOrigin(ref,req);const referring=same?pwaApplication(ref.pathname):null;if(referring)headers.set('x-nocode-route-app',referring);}catch{}}
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
