import {NextResponse} from 'next/server';
import {withAuth} from '@/lib/auth-api';
import {db,tableExists} from '@/lib/db';
import {bad,errorMessage} from '@/lib/api';
export const dynamic='force-dynamic';
export const GET=withAuth(async(req:Request,{params}:{params:{name:string}})=>{try{
const t=params.name;if(!tableExists(t))return bad('ไม่พบตาราง',404);
const u=new URL(req.url),requested=Number(u.searchParams.get('page')||1),size=Number(u.searchParams.get('page_size')||25);
if(!Number.isSafeInteger(requested)||requested<1||![10,25,50,100].includes(size))return bad('หน้าหรือจำนวนรายการต่อหน้าไม่ถูกต้อง');
const columns=(db.prepare('PRAGMA table_info("t_'+t+'")').all() as {name:string;type:string}[]).map(c=>({name:c.name,type:c.type}));
const total=(db.prepare('SELECT COUNT(*) AS total FROM "t_'+t+'"').get() as {total:number}).total,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
const rows=db.prepare('SELECT * FROM "t_'+t+'" ORDER BY id ASC LIMIT ? OFFSET ?').all(size,(page-1)*size);
return NextResponse.json({columns,rows,total,page,pages});
}catch(e){return bad(errorMessage(e));}});
