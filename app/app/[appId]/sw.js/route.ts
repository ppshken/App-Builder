import {pwaBrand} from '@/lib/pwa-server';
import {pwaBase} from '@/lib/pwa';
import {pwaWorker} from '@/lib/pwa-worker';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export const dynamic='force-dynamic';
export function GET(_req:Request,{params}:{params:{appId:string}}){if(!pwaBrand(params.appId))return new Response(null,{status:404});const base=pwaBase(params.appId);let version=process.env.NOCODE_PWA_VERSION;try{version||=readFileSync(join(process.cwd(),process.env.NOCODE_BUILD_DIR||'.next','BUILD_ID'),'utf8').trim();}catch{}return new Response(pwaWorker(base,'online-v1-'+(version||'development')),{headers:{'Content-Type':'application/javascript','Cache-Control':'no-cache','Service-Worker-Allowed':base,'X-Content-Type-Options':'nosniff'}});}
