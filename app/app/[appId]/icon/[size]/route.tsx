import {ImageResponse} from 'next/og';
import {pwaBrand} from '@/lib/pwa-server';
import Icon from '@/app/components/Icon';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params:pendingParams}:{params:Promise<{appId:string;size:string}>}){const params=await pendingParams;const brand=pwaBrand(params.appId);if(!brand||!['192','512'].includes(params.size))return new Response(null,{status:404});const size=Number(params.size);return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'transparent',borderRadius:size*.22,overflow:'hidden',color:brand.color,alignItems:'center',justifyContent:'center'}}>{brand.image?<img alt="" src={brand.image} width={size} height={size} style={{objectFit:'cover'}}/>:<Icon name={brand.icon} width={size*.8} height={size*.8} color={brand.color}/>}</div>,{width:size,height:size,headers:{'Cache-Control':'no-cache'}});}
