import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {bulkDataEpoch,bulkOptions,bulkStatus,executeBulk} from '@/lib/bulk-actions';
import {AuthError} from '@/lib/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request)=>{try{const q=new URL(req.url).searchParams,ids=q.get('ids');if(ids&&ids.length>2000)throw new AuthError('Invalid selected IDs',400);return NextResponse.json(q.has('view')?{dataEpoch:bulkDataEpoch(),actions:bulkOptions(q.get('view')||'',ids?ids.split(',').map(Number):undefined)}:bulkStatus(q.get('idempotencyKey')||''));}catch(e){return safeError(e);}});
export const POST=withAuth(async(req:Request)=>{try{
 const reader=req.body?.getReader();if(!reader)throw new AuthError('Request body required',400);
 let size=0;const chunks:Uint8Array[]=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new AuthError('Bulk request too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
 let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AuthError('Invalid JSON',400);}
 const result=await executeBulk(input);return NextResponse.json(result,{status:result.status==='running'?202:200});
 }catch(e){return safeError(e);}});
function safeError(e:unknown){return NextResponse.json({error:e instanceof AuthError?e.message:'Bulk operation unavailable; check the saved configuration',...((e as {code?:string})?.code==='DATA_EPOCH_CHANGED'?{code:'DATA_EPOCH_CHANGED'}:{})},{status:e instanceof AuthError?e.status:400});}
