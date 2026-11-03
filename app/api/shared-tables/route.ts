import {previewSharedDisconnect,disconnectSharedTables} from '@/lib/shared-table-disconnect';
import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {bad,errorMessage,errorStatus,readBody} from '@/lib/api';
import {sharedCatalog,shareTable,importSharedTable,importSharedTables,saveSharedSettings,regenerateShared,sharedTableInfo} from '@/lib/shared-tables';
import {currentUser,currentAccess} from '@/lib/permissions';
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request)=>{try{if(!currentUser()||!currentAccess().builder)return bad('เฉพาะผู้พัฒนาแอป',403);const query=new URL(req.url).searchParams;if(query.get('op')==='disconnect_preview'){let tables;try{tables=JSON.parse(query.get('tables')||'null');}catch{throw Error('รายการตารางไม่ถูกต้อง');}return NextResponse.json(previewSharedDisconnect(tables));}const table=query.get('table');return NextResponse.json(table?sharedTableInfo(table):sharedCatalog());}catch(e){return bad(errorMessage(e),errorStatus(e));}});
export const POST=withAuth(async(req:Request)=>{try{const body=await readBody(req);let result;
 switch(body.op){case 'share':result=shareTable(body);break;case 'import':result=Object.hasOwn(body,'tables')?importSharedTables(body.tables):importSharedTable(body.table);break;case 'disconnect_preview':result=previewSharedDisconnect(body.tables??[body.table]);break;case 'disconnect':result=disconnectSharedTables(body.tables??[body.table],body.token,body.confirmation);break;case 'regen_preview':result=regenerateShared(body.table);break;case 'regen':if(typeof body.token!=='string')throw Error('กรุณาตรวจโครงสร้างก่อนรีเจน');result=regenerateShared(body.table,body.token);break;default:result=saveSharedSettings(body.table,body);}
 return NextResponse.json(result);
 }catch(e){return bad(errorMessage(e),errorStatus(e));}});
