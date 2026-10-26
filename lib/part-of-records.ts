import {assertRowVersion} from "./row-version";
import {saveFormRecord} from './form-save';
import {AuthError} from "./auth";
import {db,columnsOf,tableExists} from "./db";
import {writeRecord,type WriteOptions} from "./data-write";
import {deleteRecord} from "./delete-record";
import {currentUser} from "./permissions";
import {calculateRow,refTablesOf} from "./columns";
import {asBoolean,evaluateExpression} from "./expression";
import {expressionContext} from "./expression-context";
export type ChildDraft={key:string;id?:number;values:Record<string,any>;deleted?:boolean};
export type ChildGroup={table:string;column:string;records:ChildDraft[]};
export function writeChildGroups(parent:string,id:number,groups:unknown,options:WriteOptions){if(groups===undefined){assertParentParts(parent,id);return;}if(Array.isArray(groups)&&!groups.length){assertParentParts(parent,id);return;}if(!Array.isArray(groups)||groups.length>20)throw Error("รายการลูกต้องเป็นชุดข้อมูลไม่เกิน 20 ตาราง");const now=new Date(),email=currentUser()?.email||"",ctx=expressionContext(now,email),cols=columnsOf(parent),raw=db.prepare('SELECT * FROM "t_'+parent+'" WHERE id=?').get(id) as any,{row}=calculateRow(cols,raw,false,now,false,email,ctx);const seen=new Set<string>();
 for(const group of groups){if(!group||typeof group!=="object"||!tableExists(group.table)||typeof group.column!=="string"||!Array.isArray(group.records)||group.records.length>200)throw Error("รูปแบบรายการลูกไม่ถูกต้อง เพิ่มได้ไม่เกิน 200 รายการต่อชุด");const key=group.table+':'+group.column;if(seen.has(key))throw Error("ชุดรายการลูกซ้ำ");seen.add(key);const link=columnsOf(group.table).find(c=>c.name===group.column&&c.type==="ref"&&!c.is_virtual&&(c.is_part_of||c.related_required)&&c.ref_table===parent);if(!link)throw Error("Ref นี้ไม่ได้กำหนดเป็นรายการลูกในฟอร์มของตารางแม่");if(!group.records.length)continue;const evaluate=(source:string|undefined|null)=>!source?.trim()||asBoolean(evaluateExpression(source,row,{...ctx,refTables:refTablesOf(cols),userEmail:email}));if(!evaluate(link.part_show_if))throw Error("ส่วนรายการลูกไม่ผ่านเงื่อนไขแสดงผล กรุณาตรวจข้อมูลตารางแม่");const rowIds=new Set<number>();for(const record of group.records){if(++options.budget.count>200)throw Error("บันทึกเพิ่มหรือแก้ไขรายการลูกพร้อมกันได้ไม่เกิน 200 รายการ");if(!record||typeof record!=="object"||record.deleted!==undefined&&typeof record.deleted!=="boolean"||!record.values||typeof record.values!=="object"||Array.isArray(record.values))throw Error("ข้อมูลรายการลูกไม่ถูกต้อง");const childId=record.id;if(childId!==undefined){if(!Number.isSafeInteger(childId)||childId<1||rowIds.has(childId))throw Error("ID รายการลูกไม่ถูกต้องหรือซ้ำ");rowIds.add(childId);const existing=db.prepare('SELECT "'+link.name+'" AS parent FROM "t_'+group.table+'" WHERE id=?').get(childId) as {parent:number}|undefined;if(!existing||existing.parent!==id)throw Error("รายการลูกไม่ได้อยู่ในแถวแม่ที่กำลังบันทึก");}else if(record.deleted)continue;else if(!evaluate(link.part_add_if))throw Error("ไม่ผ่านเงื่อนไขเพิ่มรายการลูก กรุณาตรวจข้อมูลตารางแม่");try{if(record.deleted){const existing=db.prepare('SELECT * FROM "t_'+group.table+'" WHERE id=?').get(childId!) as Record<string,any>|undefined;assertRowVersion(group.table,columnsOf(group.table),existing,record.values.__version);deleteRecord(group.table,childId!);}else saveFormRecord(group.table,record.values,childId,record.values.__form_view||null,email,{depth:options.depth+1,budget:options.budget,parents:options.parents,link:{column:link.name,id}});}catch(e){throw new AuthError('รายการลูก '+group.table+' · '+(e as Error).message,e instanceof AuthError?e.status:400);}}
 }
 assertParentParts(parent,id);
}
export function assertParentParts(parent:string,id:number) {
 const links=db.prepare("SELECT table_name,name FROM _columns WHERE type='ref' AND is_virtual=0 AND ref_table=? AND (related_required=1 OR (is_part_of=1 AND part_valid_if IS NOT NULL AND part_valid_if<>''))").all(parent) as {table_name:string;name:string}[];
 if(!links.length)return;
 const cols=columnsOf(parent),raw=db.prepare('SELECT * FROM "t_'+parent+'" WHERE id=?').get(id) as any;
 if(!raw)return;
 const now=new Date(),email=currentUser()?.email||"",ctx=expressionContext(now,email),{row}=calculateRow(cols,raw,false,now,false,email,ctx);
 for(const item of links){const c=columnsOf(item.table_name).find(c=>c.name===item.name)!;
 const records=db.prepare('SELECT id FROM "t_'+item.table_name+'" WHERE "'+c.name+'"=?').all(id) as {id:number}[];
 if(c.related_required&&!records.length)throw Error("รายการที่เกี่ยวข้อง "+item.table_name+" · "+c.label+" ต้องมีข้อมูลอย่างน้อย 1 รายการก่อนบันทึก");
 if(c.is_part_of&&c.part_valid_if?.trim()&&!asBoolean(evaluateExpression(c.part_valid_if!,{...row,_THIS:records.map(r=>String(r.id))},{...ctx,refTables:refTablesOf(cols),userEmail:email})))throw Error('รายการลูก '+item.table_name+' ไม่ผ่าน Valid_If กรุณาตรวจจำนวนรายการหรือเงื่อนไขที่กำหนด');
 }
}
