import {NextResponse} from 'next/server';import {withAuth} from '@/lib/auth-api';import {bad,errorMessage,errorStatus} from '@/lib/api';import {performanceReport} from '@/lib/performance-report';
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request)=>{try{return NextResponse.json(performanceReport(new URL(req.url).searchParams.get('table')||undefined));}catch(e){return bad(errorMessage(e),errorStatus(e));}});
