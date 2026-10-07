import {assertRowAllowed} from "@/lib/row-access";
import {AuthError} from "@/lib/auth";
import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import {NextResponse} from "next/server";
import {db,columnsOf,tableExists} from "@/lib/db";
import {readBody,bad,errorMessage} from "@/lib/api";
import {assertUniqueRow,UniqueValueError} from "@/lib/unique";
export const dynamic="force-dynamic";
async function handlePOST(req:Request,{params}:{params:{table:string}}){try{
 if(!tableExists(params.table))return bad("ไม่พบตาราง",404);
 const body=await readBody(req);if(!body.values||typeof body.values!=="object"||Array.isArray(body.values))throw Error("ค่าที่ตรวจต้องเป็นข้อมูลของคอลัมน์");
 if(body.id!=null&&(!Number.isSafeInteger(body.id)||body.id<1))throw Error("รหัสแถวไม่ถูกต้อง");
 if(body.id){const row=db.prepare(`SELECT * FROM "t_${params.table}" WHERE id=?`).get(body.id) as any;if(!row)throw new AuthError("ไม่พบข้อมูล",404);assertRowAllowed(params.table,row,"update");}
 const errors:Record<string,string>={};
 for(const column of columnsOf(params.table).filter(c=>!c.is_virtual&&(c.is_unique||c.is_key)&&Object.hasOwn(body.values,c.name))){try{assertUniqueRow(db,params.table,[column],body.values,body.id);}catch(e){if(e instanceof UniqueValueError)Object.assign(errors,e.errors);else errors[column.name]=errorMessage(e);}}
 return NextResponse.json({errors});
 }catch(e){return bad(errorMessage(e),errorStatus(e));}}

export const POST = withAuth(handlePOST);
