import {cloneApplication,deleteApplication} from '@/lib/application-lifecycle';
import {assertManageApplication} from '@/lib/applications';
import {applicationRolesOverview,manageApplicationRoles} from '@/lib/application-roles';
import {platformOverview} from '@/lib/platform-overview';
import {backupBeforeSchema} from '@/lib/database-backup';
import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {currentAccess,currentUser} from '@/lib/permissions';
import {SESSION_AGE,AuthError} from '@/lib/auth';
import {bad,errorMessage,errorStatus,readBody} from '@/lib/api';
import {APPLICATION_COOKIE,applicationCookie} from '@/lib/application-context';
import {DRAFT_COOKIE} from '@/lib/releases';
import {applications,createApplication,updateApplication,applicationScopeFor,applicationCatalog,setApplicationDataset,setApplicationRole,setApplicationRoleActions} from '@/lib/applications';
export const dynamic='force-dynamic';
function visible(app:ReturnType<typeof createApplication>){return applications(currentUser()).find(a=>a.id===app.id)!;}
function owner(){if(!currentAccess().owner)throw new AuthError('เฉพาะเจ้าของระบบที่จัดการแอปได้',403);}
export const GET=withAuth(async(req:Request)=>{try{const params=new URL(req.url).searchParams;if(params.get('overview')==='1'){owner();return NextResponse.json(platformOverview());}const roleApp=params.get('roles');if(roleApp){owner();return NextResponse.json(applicationRolesOverview(roleApp));}const id=params.get('id');if(id){owner();return NextResponse.json(applicationCatalog(id));}const response=NextResponse.json(applications(currentUser()));response.headers.set('X-Nocode-Selected-App',applicationCookie(req.headers.get('cookie')));return response;}catch(e){return bad(errorMessage(e),errorStatus(e));}});
export const POST=withAuth(async(req:Request)=>{try{const b=await readBody(req);if(b.op==='select'){if(typeof b.id!=='string')throw new AuthError('กรุณาเลือกแอป');applicationScopeFor(currentUser()!,b.id);const response=NextResponse.json({ok:true,id:b.id});response.cookies.set(APPLICATION_COOKIE,b.id,{httpOnly:true,sameSite:'strict',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:SESSION_AGE/1000});response.cookies.set(DRAFT_COOKIE,'',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});return response;}if(b.op==='clone'){assertManageApplication(currentUser()!,b.id);backupBeforeSchema();return NextResponse.json(cloneApplication(currentUser()!,b.id,b.label,b.mode,b.include_data??false),{status:201});}owner();backupBeforeSchema();return NextResponse.json(visible(createApplication(b.label,b.description)),{status:201});}catch(e){return bad(errorMessage(e),errorStatus(e));}});
export const PUT=withAuth(async(req:Request)=>{try{const b=await readBody(req);if(!b.op){assertManageApplication(currentUser()!,b.id);return NextResponse.json(visible(updateApplication(b.id,b.label,b.description)));}owner();if(typeof b.op==='string'&&b.op.startsWith('app_'))return NextResponse.json(manageApplicationRoles(b.id,b));if(b.op==='dataset'){setApplicationDataset(b.id,b.table,b.rights,b.remove===true);return NextResponse.json({ok:true});}if(b.op==='role_actions'){setApplicationRoleActions(b.id,b.role,b.actions);return NextResponse.json({ok:true});}if(b.op==='role'){setApplicationRole(b.id,b.role,b.can_use,b.builder);return NextResponse.json({ok:true});}return NextResponse.json(visible(updateApplication(b.id,b.label,b.description)));}catch(e){return bad(errorMessage(e),errorStatus(e));}});

export const DELETE=withAuth(async(req:Request)=>{try{const id=new URL(req.url).searchParams.get('id');assertManageApplication(currentUser()!,id);backupBeforeSchema();const result=deleteApplication(currentUser()!,id),response=NextResponse.json(result);if(applicationCookie(req.headers.get('cookie'))===id){response.cookies.set(APPLICATION_COOKIE,'default',{httpOnly:true,sameSite:'strict',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:SESSION_AGE/1000});response.cookies.set(DRAFT_COOKIE,'',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});}return response;}catch(e){return bad(errorMessage(e),errorStatus(e));}});
