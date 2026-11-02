import {ImageResponse} from 'next/og';
import {pwaBrand} from '@/lib/pwa-server';
import Icon from '@/app/components/Icon';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params:pendingParams}:{params:Promise<{appId:string;size:string}>}){const params=await pendingParams;const brand=pwaBrand(params.appId);if(!brand||!['192','512'].includes(params.size))return new Response(null,{status:404});const size=Number(params.size);return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:brand.color,color:'#fff',alignItems:'center',justifyContent:'center'}}>{brand.image?<img alt="" src={brand.image} width={size*.6} height={size*.6} style={{objectFit:'contain'}}/>:<Icon name={brand.icon} width={size*.5} height={size*.5} color="#ffffff"/>}</div>,{width:size,height:size,headers:{'Cache-Control':'no-cache'}});}
