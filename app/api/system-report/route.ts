import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {currentAccess} from '@/lib/permissions';
import {AuthError} from '@/lib/auth';
import {bad,errorMessage,errorStatus} from '@/lib/api';
import {systemReport} from '@/lib/system-report';
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request)=>{try{if(!currentAccess().owner)throw new AuthError('เฉพาะเจ้าของ Builder / Admin สูงสุดที่ดูรายงานระบบได้',403);return NextResponse.json(systemReport(new URL(req.url).searchParams.get('refresh')==='1'));}catch(e){return bad(errorMessage(e),errorStatus(e));}});
