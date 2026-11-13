import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {databasePath} from '@/lib/db';
import {currentUser} from '@/lib/permissions';
import {AuthError} from '@/lib/auth';
import {readBody} from '@/lib/api';
import {backupRetentionOverview,saveBackupRetentionPolicy,createBackupCleanupPreview,executeBackupCleanup} from '@/lib/backup-retention';
export const dynamic='force-dynamic';
function failure(e:unknown){return NextResponse.json({error:e instanceof AuthError?e.message:'จัดการไฟล์สำรองไม่สำเร็จ กรุณาตรวจสิทธิ์พื้นที่จัดเก็บและลองอีกครั้ง'},{status:e instanceof AuthError?e.status:500});}
export const GET=withAuth(async()=>{try{return NextResponse.json(backupRetentionOverview(databasePath));}catch(e){return failure(e);}});
export const PUT=withAuth(async(req:Request)=>{try{return NextResponse.json({policy:saveBackupRetentionPolicy(databasePath,await readBody(req),currentUser()!.id)});}catch(e){return failure(e);}});
export const POST=withAuth(async(req:Request)=>{try{const b=await readBody(req);if(b.op==='preview')return NextResponse.json(createBackupCleanupPreview(databasePath,currentUser()!.id));if(b.op==='cleanup')return NextResponse.json(executeBackupCleanup(databasePath,currentUser()!.id,b.token,b.confirmation));throw new AuthError('คำสั่งล้างไฟล์สำรองไม่ถูกต้อง');}catch(e){return failure(e);}});
