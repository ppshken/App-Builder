import {enqueueManual} from "./workflows";
import {deleteRecord} from "./delete-record";
import {writeRecord} from "./data-write";
import {communicationUrl,safeActionUrl,type ActionAppearance,type ActionConfig,type ActionKind,actionPermission} from "./action-config";
import {assertRowAllowed,rowAllowed} from "./row-access";
import {canRead,canExecuteAction,assertReferenceWrites,assertTablePermission} from "./permissions";
import { columnsOf, db, tableExists } from "./db";
import { normalizeValue, assertIdentifier, calculateRow, assertFormulas, refTablesOf, evaluateColumnExpression } from "./columns";
import { asBoolean, evaluateExpression, references, tableReferences, ExpressionContext } from "./expression";
import { expressionContext } from "./expression-context";
export type Slice = { name: string; label: string; table_name: string; filter_expr: string; columns: string[] };
export type RowAction = { name: string; label: string; table_name: string; kind: ActionKind;config?:ActionConfig;appearance?:ActionAppearance; condition_expr: string; values: Record<string, string>; confirmation: string };
export function checkFormula(table: string, source: unknown) {
  if (typeof source !== "string" || !source.trim()) throw new Error("กรุณากรอกสูตร เช่น TRUE หรือ [status] = \"เปิด\"");
  const names = new Set(["id", ...columnsOf(table).map(c => c.name)]);
  for (const name of references(source)) if (!names.has(name)) throw new Error(`ไม่พบคอลัมน์ [${name}] กรุณาเลือกคอลัมน์จากตารางนี้`);
  for (const ref of tableReferences(source)) {
    if (!tableExists(ref.table)) throw new Error(`ไม่พบตาราง ${ref.table}`);
    if (ref.column !== "id" && !columnsOf(ref.table).some(c => c.name === ref.column)) throw new Error(`ไม่พบคอลัมน์ [${ref.column}] ในตาราง ${ref.table}`);
  }
  const schema = Object.fromEntries((db.prepare("SELECT name FROM _tables").all() as {name:string}[]).map(t => [t.name, columnsOf(t.name)]));
  assertFormulas([...columnsOf(table), { name: "expression_check", label: "สูตร", type: "text", show_if: source }], schema);
  return source.trim();
}
export function slices(): Slice[] { return (db.prepare("SELECT * FROM _slices ORDER BY label,name").all() as any[]).filter(s=>canRead(s.table_name)).map(({ columns_json, ...s }) => ({ ...s, columns: JSON.parse(columns_json) })); }
export function actions(table?: string): RowAction[] { return (db.prepare("SELECT * FROM _actions ORDER BY label,name").all() as any[]).filter(a => (!table || a.table_name === table) && canRead(a.table_name) && canExecuteAction(a)).map(({ values_json,config_json,appearance_json, ...a }) => ({ ...a, values: JSON.parse(values_json),config:JSON.parse(config_json||"{}"),appearance:JSON.parse(appearance_json||"{}") })); }
export function sliceFor(name: string | null, table: string) {
  if (!name) return null;
  assertIdentifier(name); const s = slices().find(s => s.name === name && s.table_name === table);
  if (!s) throw new Error("ไม่พบ Slice ของตารางนี้ กรุณาเลือก Slice ใหม่"); return s;
}
export function matches(source: string, row: Record<string, any>, userEmail = "", table?: string, context: ExpressionContext = expressionContext(new Date(), userEmail)) { return asBoolean(evaluateExpression(source, row, { ...context, refTables: table ? refTablesOf(columnsOf(table)) : {}, userEmail })); }
export function executeAction(name: string, id: number, userEmail: string, sliceName: string | null) {
  assertIdentifier(name);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("กรุณาเลือกแถวข้อมูล");
  const a = actions().find(a => a.name === name); if (!a || !tableExists(a.table_name)) throw new Error("ไม่พบ Action");
  const t = a.table_name, cols = columnsOf(t), now = new Date(), slice = sliceFor(sliceName, t);
  return db.transaction(() => {
    const context = expressionContext(now, userEmail);
    const old = db.prepare(`SELECT * FROM "t_${t}" WHERE id=?`).get(id) as Record<string, any> | undefined;
    if (!old) throw new Error("ไม่พบแถวข้อมูล อาจถูกลบไปแล้ว");
    assertRowAllowed(t,old,["copy","add","new_form"].includes(a.kind)?"read":actionPermission(a.kind));
    const { row } = calculateRow(cols, old, false, now, false, userEmail, context);
    if (slice && !matches(slice.filter_expr, row, userEmail, t, context)) throw new Error("แถวนี้ไม่อยู่ใน Slice ที่เปิดอยู่");
    if (!matches(a.condition_expr, row, userEmail, t, context)) throw new Error("แถวนี้ไม่ตรงเงื่อนไขของ Action กรุณาโหลดข้อมูลใหม่");
    if(a.kind==="automation")return {ok:true,job_id:enqueueManual(a.config?.automation_name||"",id),message:"เพิ่มงาน Automation ในคิวแล้ว"};
    if(a.kind==="grouped"){const names=a.config?.actions;if(!Array.isArray(names)||!names.length||names.length>10)throw Error("เลือก Action 1–10 รายการ");for(let i=0;i<names.length;i++){const child=actions().find(item=>item.name===names[i]);if(!child||child.table_name!==t||!["set","add","copy","delete"].includes(child.kind)||child.kind==="delete"&&i!==names.length-1)throw Error("Action ย่อยต้องเป็นการเปลี่ยน/เพิ่ม/คัดลอกข้อมูลในตารางเดียวกัน และลบได้เฉพาะขั้นตอนสุดท้าย");executeAction(child.name,id,userEmail,sliceName);}return {ok:true,deleted:actions().find(item=>item.name===names[names.length-1])?.kind==="delete"};}
    if(["call","sms","email"].includes(a.kind))return {ok:true,url:communicationUrl(a.kind,evaluateExpression(a.config?.url_expr||'""',row,{...context,userEmail,refTables:refTablesOf(cols)}))};
    if(a.kind==="open_url")return {ok:true,url:safeActionUrl(evaluateExpression(a.config?.url_expr||'""',row,{...context,userEmail,refTables:refTablesOf(cols)}))};
    if(["open_view","edit_form","new_form","open_detail"].includes(a.kind)){const target=db.prepare("SELECT * FROM _views WHERE name=?").get(a.config?.view_name) as any;if(!target||!canRead(target.table_name))throw Error("ไม่มีสิทธิ์เปิด View นี้");if(a.kind==="open_detail"?target.kind!=="detail":a.kind!=="open_view"&&(target.kind!=="form"||a.kind==="edit_form"&&target.table_name!==t))throw Error("กรุณาเลือก View แบบฟอร์มที่เหมาะกับ Action");if(target.kind==="form")assertTablePermission(target.table_name,a.kind==="new_form"?"create":target.table_name===t?"update":"create");if(target.show_if&&!matches(target.show_if,{},userEmail,undefined,context))throw Error("View นี้ถูกซ่อนด้วยเงื่อนไข");if(a.kind==="open_detail"){const key=evaluateExpression(a.config?.row_expr||"",row,{...context,userEmail,refTables:refTablesOf(cols)});if(!["string","number"].includes(typeof key)||!Number.isSafeInteger(Number(key))||Number(key)<1)throw Error("สูตรแถวปลายทางต้องให้ค่า id เป็นจำนวนเต็มบวก");const targetRow=db.prepare('SELECT * FROM "t_'+target.table_name+'" WHERE id=?').get(Number(key)) as Record<string,any>|undefined;if(!targetRow)throw Error("ไม่พบแถวรายละเอียดตาม id ที่สูตรกำหนด");assertRowAllowed(target.table_name,targetRow,"read");const targetSlice=sliceFor(target.slice_name,target.table_name);if(targetSlice&&!matches(targetSlice.filter_expr,calculateRow(columnsOf(target.table_name),targetRow,false,now,false,userEmail,context).row,userEmail,target.table_name,context))throw Error("แถวปลายทางไม่อยู่ใน Slice ของหน้ารายละเอียด");return {ok:true,navigate:{name:target.name,id:Number(key)}};}
      const initialValues:Record<string,any>={};if(a.kind==="new_form"){const targetCols=columnsOf(target.table_name);for(const [name,expr] of Object.entries(a.config?.initial_values||{})){const col=targetCols.find(c=>c.name===name&&!c.is_virtual&&c.is_editable!==false&&c.is_editable!==0);if(!col)throw Error("คอลัมน์ค่าตั้งต้นของฟอร์มไม่มีอยู่หรือแก้ไขไม่ได้ กรุณาแก้ Action");initialValues[name]=normalizeValue(col,evaluateColumnExpression(col,expr,row,{...context,userEmail,refTables:refTablesOf(cols)}));}assertReferenceWrites(targetCols,initialValues);}
      return {ok:true,navigate:{name:target.name,initialValues,id:a.kind!=="new_form"&&target.table_name===t&&['detail','form'].includes(target.kind)?id:undefined}};}
    if(a.kind==="copy"||a.kind==="add"){const body:Record<string,any>=a.kind==="copy"?Object.fromEntries(cols.filter(c=>!c.is_virtual&&c.is_editable!==false&&c.is_editable!==0&&!c.is_key&&!c.is_unique).map(c=>[c.name,row[c.name]])):{};for(const [name,expr] of Object.entries(a.values)){const c=cols.find(c=>c.name===name)!;body[name]=evaluateColumnExpression(c,expr,row,{...context,userEmail,refTables:refTablesOf(cols)});}return {...writeRecord(t,body),ok:true};}
    if (a.kind === "delete") { deleteRecord(t,id); }
    else {
      const candidate = { ...old };
      for (const [column, expr] of Object.entries(a.values)) {
        const c = cols.find(c => c.name === column && !c.is_virtual);
        if (!c) throw new Error("Action อ้างอิงคอลัมน์ที่แก้ไขไม่ได้ กรุณาแก้การตั้งค่า Action");
        candidate[column] = evaluateColumnExpression(c,expr,row,{ ...context, refTables: refTablesOf(cols), now, userEmail });
      }
      writeRecord(t,Object.fromEntries(Object.keys(a.values).map(name=>[name,candidate[name]])),id);
    }
    return { ok: true };
  })();
}
