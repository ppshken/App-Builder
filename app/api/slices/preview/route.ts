import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {bad,errorMessage,errorStatus,readBody} from '@/lib/api';
import {previewSlice} from '@/lib/slice-preview';
export const dynamic='force-dynamic';
export const POST=withAuth(async(req:Request)=>{try{return NextResponse.json(previewSlice(await readBody(req)));}catch(e){return bad(errorMessage(e),errorStatus(e));}});
