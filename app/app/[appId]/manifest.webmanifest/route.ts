import {pwaBrand} from '@/lib/pwa-server';
import {pwaManifest} from '@/lib/pwa';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params:pendingParams}:{params:Promise<{appId:string}>}){const params=await pendingParams;const brand=pwaBrand(params.appId);return brand?Response.json(pwaManifest(params.appId,brand.name,brand.color),{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-store'}}):new Response(null,{status:404});}
