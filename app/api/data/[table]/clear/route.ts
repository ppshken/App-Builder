import {AuthError} from "@/lib/auth";
import {deleteRecord} from "@/lib/delete-record";
import {NextResponse} from "next/server";
import {withAuth} from "@/lib/auth-api";
import {currentAccess,assertTablePermission} from "@/lib/permissions";
import {db,columnsOf,tableExists} from "@/lib/db";
import {bad,readBody,errorMessage} from "@/lib/api";
export const dynamic="force-dynamic";
export const POST=withAuth(async(req:Request,{params}:{params:{table:string}})=>{
 try{
  const access=currentAccess();if(!access.builder&&!access.owner)return bad("เฉพาะผู้จัดการแอปที่มีสิทธิ์ลบข้อมูลเท่านั้นที่เคลียร์ทั้งตารางได้",403);
  const table=params.table;assertTablePermission(table,"delete");assertTablePermission(table,"read");
  if(!tableExists(table))return bad("ไม่พบตาราง",404);columnsOf(table);
  const body=await readBody(req);if(body.confirmation!=="เคลียร์ข้อมูลทั้งหมด")return bad('พิมพ์ “เคลียร์ข้อมูลทั้งหมด” ให้ตรงเพื่อยืนยัน');
  const deleted=db.transaction(()=>{
   let cascade=false;
   const targets=db.prepare("SELECT name,label FROM _tables WHERE name<>?").all(table) as {name:string;label:string}[];
   for(const target of targets)for(const col of columnsOf(target.name).filter(c=>!c.is_virtual&&c.ref_table===table&&["ref","list"].includes(c.type))){
    const used=col.type==="ref"?db.prepare('SELECT 1 FROM "t_'+target.name+'" AS source JOIN "t_'+table+'" AS target ON source."'+col.name+'"=target.id LIMIT 1').get():db.prepare('SELECT 1 FROM "t_'+target.name+'" AS source,json_each(source."'+col.name+'") AS item JOIN "t_'+table+'" AS target ON CAST(item.value AS TEXT)=CAST(target.id AS TEXT) LIMIT 1').get();
    if(used&&col.type==="ref"&&(col.ref_delete_cascade||col.is_part_of)){cascade=true;continue;}
    if(used)throw Error('เคลียร์ไม่ได้: ตาราง “'+target.label+'” คอลัมน์ “'+col.label+'” ยังอ้างอิงข้อมูลอยู่ กรุณานำข้อมูลอ้างอิงออกก่อน');
   }
   let deleted:number;
   if(cascade){
    const ids=db.prepare('SELECT id FROM "t_'+table+'" ORDER BY id').all() as {id:number}[];
    for(const row of ids)deleteRecord(table,row.id,0,{emitWorkflow:false});
    deleted=ids.length;
   }else deleted=db.prepare('DELETE FROM "t_'+table+'"').run().changes;

   db.prepare("DELETE FROM sqlite_sequence WHERE name=?").run('t_'+table);
   return deleted;
  })();
  return NextResponse.json({ok:true,deleted});
 }catch(e){return bad(errorMessage(e),e instanceof AuthError?e.status:400);}
});
