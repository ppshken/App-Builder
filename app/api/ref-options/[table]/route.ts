import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {readBody,bad,errorMessage,errorStatus} from '@/lib/api';
import {referenceOptions} from '@/lib/ref-options';
import {refreshExternalTable} from '@/lib/external-sources';
export const dynamic='force-dynamic';
export const POST=withAuth(async(req:Request,{params}:{params:{table:string}})=>{try{const body=await readBody(req);await refreshExternalTable(params.table);return NextResponse.json(referenceOptions(params.table,body,req.headers.get('x-nocode-preview-email')||''));}catch(e){return bad(errorMessage(e),errorStatus(e));}});
