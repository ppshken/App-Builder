import {assertInternalTable,createExternalReadView} from './external-storage';
import {currentApplication} from './application-context';
import {applicationDatabase} from './db';
import {validateCustomData} from './custom-page-references';
import {realtimeTriggerDefinitions} from "./realtime-schema";
import {validateStoredWorkflows} from "./workflow-validation";
import {registerAuditFunctions} from "./audit-schema";
import {withoutAudit} from "./audit-context";
import {assertPartSchema} from "./part-of-config";
import {actionConfigExpressions} from "./action-config";
import Database from "better-sqlite3";
import {createHash} from "node:crypto";
import {normalizeMaxLength,assertIdentifier,assertFormulas,Column,FORMULA_FIELDS,SQLTYPE,normalizeValue,calculateRow,formState,refTablesOf} from "./columns";
import {assertUniqueColumn} from "./unique";
import {normalizeDateTime} from "./datetime";
import {readColumns,rebuildTable,columnDefinition,foreignKeyTransaction,syncKeyIndex,createInlineViews} from "./schema";
import {expressionContext} from "./expression-context";
import {references,tableReferences,evaluateExpression} from "./expression";
import {validateDisplay} from "./view-display";
import {validateViewCondition,viewIsVisible} from "./view-visibility";

export type ConversionRequest={column:string;mode:"replace"|"copy";target:Partial<Column>;ref_match?:"id"|"key"};
export type ConversionReport={allowed:boolean;total:number;converted:number;failed:number;samples:{id:number;before:string;after:string}[];issues:{table:string;id?:number;before?:string;message:string}[];warnings:string[];source:Column;target:Column;mode:"replace"|"copy"};
// Hash logical conversion inputs, never SQLite pages, sessions, audit or queue progress.
export function conversionFingerprint(database:Database.Database,table?:string,request?:ConversionRequest){
 const hash=createHash('sha256');const add=(name:string,rows:unknown)=>hash.update(JSON.stringify([name,rows]));
 const metadata=['_tables','_columns','_views','_slices','_actions','_pdf_templates','_role_row_rules','_user_setting_defs'];
 for(const name of metadata)if(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)){const rows=database.prepare('SELECT * FROM "'+name+'"').all();add(name,rows.map(row=>JSON.stringify(row)).sort());}
 if(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_automations'").get())add('_automations',database.prepare('SELECT name,label,table_name,enabled,event,config_json,owner_id FROM _automations ORDER BY name').all());
 const tables=(database.prepare('SELECT name FROM _tables ORDER BY name').all() as {name:string}[]).map(t=>t.name);const names=table?[table,request?.target.ref_table].filter((name):name is string=>!!name):tables;
 for(const name of [...new Set(names)].sort()){assertIdentifier(name);if(!tables.includes(name))throw Error('ไม่พบตารางที่เกี่ยวข้องกับการแปลง');add('schema:'+name,database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get('t_'+name));add('data:'+name,database.prepare('SELECT * FROM "t_'+name+'" ORDER BY id').all());}
 return hash.digest('hex');
}
function shown(value:unknown){const text=typeof value==="string"?value:JSON.stringify(value)??"ว่าง";return text.length>180?text.slice(0,180)+"…":text;}
function decimalIdentity(text:string){
 const match=/^([+-]?)(\d*\.?\d+)(?:[eE]([+-]?\d+))?$/.exec(text);if(!match)throw Error("ต้องเป็นตัวเลข เช่น 1250 หรือ 12.50 ห้ามมีข้อความหรือเครื่องหมายคั่นหลักพัน");
 const parts=match[2].split("."),exponent=Number(match[3]||0)-(parts[1]?.length||0);let digits=parts.join("").replace(/^0+/,""),power=exponent;
 if(!digits)return "0";if(!Number.isSafeInteger(power))throw Error("ตัวเลขละเอียดหรือใหญ่เกินกว่าชนิดข้อมูลนี้เก็บได้");
 while(digits.endsWith("0")){digits=digits.slice(0,-1);power++;}return `${match[1]==="-"?"-":""}${digits}e${power}`;
}
// Explicit conversions only: no SQLite CAST, guessing comma-separated lists, or discarding list items.
export function convertValue(source:Column,target:Column,raw:unknown,resolveRef?:(value:unknown)=>number):unknown{
 let value=normalizeValue(source,raw);
 if(["text","longtext"].includes(target.type))return normalizeValue(target,value==null?null:Array.isArray(value)?JSON.stringify(value):String(value));
 if(value==null||(Array.isArray(value)&&!value.length))return ["enumlist","list"].includes(target.type)?[]:null;
 if(["enumlist","list"].includes(target.type)){
  let items:unknown=value;if(!Array.isArray(items)){if(typeof items==="string"&&items.trim().startsWith("[")){try{items=JSON.parse(items);}catch{throw Error("รายการ JSON ไม่ถูกต้อง กรุณาแก้ข้อมูลต้นฉบับ");}}else items=[String(items)];}
  return normalizeValue(target,items);
 }
 if(Array.isArray(value)){if(value.length!==1)throw Error("มีหลายรายการ จึงแปลงเป็นค่าเดียวไม่ได้ กรุณาเลือกชนิด List หรือเก็บไว้ในคอลัมน์เดิม");value=value[0];}
 if(target.type==="ref"&&resolveRef)return resolveRef(value);
 if(["number","decimal","price","percent","rating","user"].includes(target.type)){
  if(typeof value==="string"){
   const text=value.trim(),identity=decimalIdentity(text),number=Number(text);
   if(!Number.isFinite(number)||Number.isInteger(number)&&!Number.isSafeInteger(number)||decimalIdentity(String(number))!==identity)throw Error("ตัวเลขใหญ่หรือละเอียดเกินกว่าจะเก็บครบ กรุณาเก็บเป็นข้อความ");
   value=number;
  }
  return normalizeValue(target,value);
 }
 if(target.type==="yesno"&&typeof value==="string"){
  const text=value.trim().toLocaleLowerCase();if(["true","yes","ใช่","1"].includes(text))value=1;else if(["false","no","ไม่ใช่","0"].includes(text))value=0;
 }
 if(target.type==="time"&&source.type==="datetime"&&typeof value==="string")value=normalizeDateTime(value).slice(11,19);
 if(target.type==="datetime"&&typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=normalizeDateTime(value+"T00:00:00+07:00");
 if(target.type==="date"&&typeof value==="string"&&value.includes("T"))value=normalizeDateTime(value).slice(0,10);
 if(target.type==="enum"&&typeof value==="number")value=String(value);
 return normalizeValue(target,value);
}
// Cached API datasets are Builder-owned views over metadata, not dependent SQL views.
// Compare canonical SQL, not just names, so modified/custom views remain protected.
function managedExternalViews(database:Database.Database,objects:{name:string;type:string;sql:string|null}[]){
 const trusted=new Set<string>(),template=new Database(':memory:');
 try{for(const object of objects.filter(o=>o.type==='view')){
  const row=database.prepare("SELECT name,source_id FROM _tables WHERE source_kind='EXTERNAL_REST_API' AND 't_'||name=?").get(object.name) as {name:string;source_id:string}|undefined;
  if(!row)continue;
  createExternalReadView(template,row.name,readColumns(database,row.name),row.source_id);
  const canonical=template.prepare("SELECT sql FROM sqlite_master WHERE type='view' AND name=?").get(object.name) as {sql:string};
  if(canonical.sql===object.sql)trusted.add(object.name);
 }}finally{template.close();}
 return trusted;
}
function prepare(database:Database.Database,table:string,request:ConversionRequest){
 assertIdentifier(table);if(!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(table))throw Error("ไม่พบตาราง");
 if(request.mode==="replace"&&(database.prepare("SELECT expression FROM _role_row_rules WHERE table_name=?").all(table) as {expression:string}[]).some(r=>references(r.expression).includes(request.column)))throw Error("คอลัมน์นี้ใช้ในกฎสิทธิ์ระดับแถว กรุณาแก้กฎก่อนแปลงชนิดข้อมูล หรือเลือกคัดลอกไปคอลัมน์ใหม่");
 assertInternalTable(database,table);const cols=readColumns(database,table),source=cols.find(c=>c.name===request.column);if(!source)throw Error("ไม่พบคอลัมน์ที่ต้องการแปลง");if(source.auto_number)throw Error("กรุณาปิดเลขรันอัตโนมัติก่อนเปลี่ยนชนิดหรือคัดลอกคอลัมน์");
 if(source.is_virtual)throw Error("ช่องคำนวณไม่เก็บข้อมูลจริง กรุณาแก้สูตรหรือสร้างคอลัมน์ข้อมูลใหม่");
 const objects=database.prepare("SELECT name,type,sql FROM sqlite_master WHERE tbl_name=? OR type='view'").all(`t_${table}`) as {name:string;type:string;sql:string|null}[];
 const trustedViews=managedExternalViews(database,objects);
 const knownIndexes=new Set([`_key_${table}`,...cols.filter(c=>c.type==="ref"&&!c.is_virtual).map(c=>`_ref_${table}_${c.name}`),...cols.filter(c=>c.is_unique&&!c.is_virtual).map(c=>`_unique_${table}_${c.name}`)]);
 if(objects.some(o=>o.type==="trigger"&&!realtimeTriggerDefinitions(table).some(t=>t.name===o.name&&t.sql===o.sql)||request.mode==="replace"&&(o.type==="view"&&!trustedViews.has(o.name)||o.type==="index"&&o.sql&&!knownIndexes.has(o.name))))throw Error("ตารางนี้มี SQL View, Trigger หรือดัชนีที่เพิ่มนอกระบบ กรุณาจัดการส่วนนี้ก่อน เพื่อไม่ให้สูญหายระหว่างแปลง");
 if(!["replace","copy"].includes(request.mode)||!request.target||!Object.hasOwn(SQLTYPE,request.target.type||""))throw Error("กรุณาเลือกวิธีและชนิดข้อมูลปลายทาง");
 if(request.ref_match!==undefined&&!["id","key"].includes(request.ref_match))throw Error("วิธีจับคู่ Ref ไม่ถูกต้อง");
 const target:Column={...source,scan_enabled:["text","ref"].includes(request.target.type!)?source.scan_enabled:0,related_required:request.mode!=="copy"&&request.target.type==="ref"?source.related_required:0,ref_delete_cascade:request.mode!=="copy"&&request.target.type==="ref"?source.ref_delete_cascade:0,ref_allow_add:request.target.type==="ref"?source.ref_allow_add:0,is_part_of:request.mode==="copy"||request.target.type!=="ref"?0:source.is_part_of,part_show_if:request.mode==="copy"||request.target.type!=="ref"?null:source.part_show_if,part_valid_if:request.mode==="copy"||request.target.type!=="ref"?null:source.part_valid_if,part_add_if:request.mode==="copy"||request.target.type!=="ref"?null:source.part_add_if,max_length:normalizeMaxLength(request.target.type!,["text","longtext"].includes(request.target.type!) ? request.target.max_length??source.max_length??0 : 0),gps_auto:request.target.type === "latlong" ? source.gps_auto : 0,file_path:request.target.type==='file'?source.file_path:null,image_path:request.target.type==="image"?source.image_path:null,type:request.target.type!,name:request.mode==="copy"?request.target.name!:source.name,label:request.mode==="copy"?(request.target.label||"").trim():source.label,is_unique:request.mode==="copy"?0:source.is_unique,is_key:request.mode==="copy"?0:source.is_key,is_label:request.mode==="copy"?0:source.is_label,pos:request.mode==="copy"?Math.max(-1,...cols.map(c=>c.pos||0))+1:source.pos};
 assertIdentifier(target.name);if(!target.label)throw Error("กรุณากรอกชื่อที่แสดงของคอลัมน์ใหม่");
 if(request.mode==="copy"&&(cols.length>=200||cols.some(c=>c.name===target.name)))throw Error("ชื่อคอลัมน์ใหม่ซ้ำหรือมีครบ 200 คอลัมน์แล้ว กรุณาใช้ชื่ออื่น");
 if(request.mode==="replace"&&target.type===source.type&&(request.target.ref_table||null)===(source.ref_table||null))throw Error("กรุณาเลือกชนิดข้อมูลใหม่ หรือเลือกคัดลอกไปคอลัมน์ใหม่");
 for(const field of ["default_expr","valid_if"] as const)if(Object.hasOwn(request.target,field)){if(request.target[field]!=null&&typeof request.target[field]!=="string")throw Error("สูตรต้องเป็นข้อความ");target[field]=request.target[field]?.trim()||null;}
 target.options=["enum","enumlist"].includes(target.type)?typeof request.target.options==="string"?[...new Set(request.target.options.split(",").map(v=>v.trim()).filter(Boolean))].join(","):"":null;
 target.ref_table=["ref","list","enum","enumlist"].includes(target.type)?request.target.ref_table||null:null;
 if(target.ref_table){assertIdentifier(target.ref_table);if(!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(target.ref_table))throw Error("ไม่พบตารางอ้างอิงปลายทาง");}
 if(target.type==="ref"&&!target.ref_table)throw Error("กรุณาเลือกตารางอ้างอิงปลายทาง");
 if(target.type==="enumlist"&&!target.options&&!target.ref_table&&!target.valid_if)throw Error("กรุณากำหนดตัวเลือก เลือกตารางอ้างอิง หรือใช้สูตรดึงตัวเลือกสำหรับ Enum หรือ EnumList · ไม่บังคับ Valid_If");
 if(target.is_key&&!["text","longtext","number","decimal","enum"].includes(target.type))throw Error("ชนิดนี้ใช้เป็น Key ไม่ได้ กรุณาคัดลอกไปคอลัมน์ใหม่หรือเลือก Key อื่นก่อน");
 if(target.is_label&&(source.type==="image")!==(target.type==="image"))throw Error("กรุณายกเลิก Label ก่อนแปลงระหว่างรูปภาพกับชนิดอื่น เพื่อรักษา Label ข้อความและรูปภาพอย่างละหนึ่งช่อง");
 if(target.is_label&&["ref","list","enumlist"].includes(target.type))throw Error("ชนิดนี้ใช้เป็น Label ไม่ได้ กรุณาคัดลอกไปคอลัมน์ใหม่หรือเลือก Label อื่นก่อน");
 assertUniqueColumn(target);
 return {source,target,cols};
}
function referenceResolver(database:Database.Database,target:Column,match:"id"|"key"){
 if(target.type!=="ref")return undefined;
 const columns=readColumns(database,target.ref_table!),key=match==="key"?columns.find(c=>c.is_key)?.name||"id":"id";
 const query=database.prepare(`SELECT id FROM "t_${target.ref_table}" WHERE CAST("${key}" AS TEXT)=? LIMIT 2`);
 return(value:unknown)=>{const rows=query.all(String(value)) as {id:number}[];if(rows.length!==1)throw Error(`ไม่พบรหัส "${shown(value)}" ที่ตรงกันเพียงแถวเดียวใน ${target.ref_table}[${key}] กรุณาแก้ข้อมูลหรือวิธีจับคู่ Ref`);return rows[0].id;};
}
function writeColumn(database:Database.Database,table:string,target:Column,copy:boolean){
 const fields=["auto_number_json","name","label","type","options","ref_table","required","pos","is_virtual","is_key","is_label","list_limit","is_editable","is_unique","image_path","file_path","gps_auto","max_length","is_part_of","part_show_if","part_add_if","part_valid_if","reset_on_edit","reset_columns_json","input_mode","button_limit","ref_allow_add","ref_delete_cascade","related_required",...FORMULA_FIELDS];
 const values=fields.map(field=>field==="auto_number_json"?JSON.stringify(target.auto_number??null):field==="reset_columns_json"?JSON.stringify(target.reset_columns||[]):field==="max_length"?target.max_length??0:field==="list_limit"?target.list_limit??5:field==="is_editable"?target.is_editable===0||target.is_editable===false?0:1:["required","is_virtual","is_key","is_label","is_unique","gps_auto","is_part_of","reset_on_edit","ref_allow_add","ref_delete_cascade","related_required"].includes(field)?(target as any)[field]?1:0:(target as any)[field]??null);
 if(copy)database.prepare(`INSERT INTO _columns(table_name,${fields.join(",")}) VALUES(${["?",...fields.map(()=>"?")].join(",")})`).run(table,...values);
 else database.prepare(`UPDATE _columns SET ${fields.map(field=>field+"=?").join(",")} WHERE table_name=? AND name=?`).run(...values,table,target.name);
}
function writeConversion(database:Database.Database,table:string,request:ConversionRequest,source:Column,target:Column,values:{id:number;value:unknown}[]){
 writeColumn(database,table,target,request.mode==="copy");
 if(request.mode==="copy")database.prepare(`ALTER TABLE "t_${table}" ADD COLUMN ${columnDefinition(target)}`).run();
 else rebuildTable(database,table);
 const update=database.prepare(`UPDATE "t_${table}" SET "${target.name}"=? WHERE id=?`);
 for(const row of values)update.run(["list","enumlist"].includes(target.type)?JSON.stringify(row.value):row.value,row.id);
 syncKeyIndex(database,table);
 if(request.mode==="replace"&&source.type==="ref"&&(target.type!=="ref"||source.ref_table!==target.ref_table)){
  for(const view of database.prepare("SELECT name,display_json FROM _views").all() as {name:string;display_json:string}[]){const display=JSON.parse(view.display_json),key=`${table}:${source.name}`;if(Object.hasOwn(display.related||{},key)){delete display.related[key];database.prepare("UPDATE _views SET display_json=? WHERE name=?").run(JSON.stringify(display),view.name);}}
  database.prepare("DELETE FROM _views WHERE table_name=? AND position='inline' AND inline_ref=?").run(table,source.name);
 }
 createInlineViews(database,table);
}
function rowProblem(database:Database.Database,cols:Column[],raw:Record<string,unknown>,now:Date,context:ReturnType<typeof expressionContext>){
 try{const state=formState(cols,raw,now,"",context);const error=Object.values(state.errors)[0]||Object.values(state.validation)[0];if(error)return error;
  for(const c of cols){const value=state.row[c.name];if(c.type==="file"&&value&&!database.prepare("SELECT 1 FROM _files WHERE id=?").get(String(value).slice(11)))return `ไม่พบไฟล์ของ "${c.label}"`;if(["image","signature"].includes(c.type)&&value&&!database.prepare("SELECT 1 FROM _images WHERE id=?").get(String(value).slice(12)))return `ไม่พบรูปภาพของ "${c.label}"`;
   if(c.type==="list"&&c.ref_table){if(database.prepare(`SELECT value FROM json_each(?) WHERE NOT EXISTS(SELECT 1 FROM "t_${c.ref_table}" WHERE CAST(id AS TEXT)=CAST(json_each.value AS TEXT)) LIMIT 1`).get(JSON.stringify(value||[])))return `List "${c.label}" อ้างอิงรหัสที่ไม่มีอยู่`;} }
 }catch(e){return (e as Error).message;}return "";
}
function checkDependencies(database:Database.Database,table:string,report:ConversionReport,baseline:Database.Database,now:Date){
 const all=database.prepare("SELECT name,label FROM _tables").all() as {name:string;label:string}[],schema=Object.fromEntries(all.map(t=>[t.name,readColumns(database,t.name)])),context=expressionContext(now,"",database),oldContext=expressionContext(now,"",baseline);
 const add=(owner:string,message:string,id?:number)=>{report.failed++;if(report.issues.length<20)report.issues.push({table:owner,id,message});};
 const scope=currentApplication(),inScope=(name:string)=>!scope?.datasets||!!scope.datasets[name]?.read;
 // Metadata can reveal a cross-app dependency, but must never authorize reading its rows.
 // Fail closed for such dependencies instead of disclosing another app's data or ignoring the dependency.
 for(const t of all.filter(t=>!inScope(t.name))){const cols=schema[t.name];if(cols.some(c=>c.ref_table===table||FORMULA_FIELDS.some(field=>typeof c[field]==='string'&&tableReferences(c[field] as string).some(ref=>ref.table===table)))){add(table,'มีตารางนอกแอปอ้างอิงข้อมูลนี้ จึงยังตรวจความปลอดภัยของการแปลงไม่ได้ กรุณาตรวจการเชื่อมโยงตารางก่อน');return;}}
 assertPartSchema(schema);
 for(const t of all.filter(t=>inScope(t.name))){const cols=schema[t.name];assertFormulas(cols,schema);
  // Check initial values against the new type without storing any calculated/default data.
  if(t.name===table)calculateRow(cols,{},true,now,false,"",context);
  const oldCols=readColumns(baseline,t.name),oldRow=baseline.prepare(`SELECT * FROM "t_${t.name}" WHERE id=?`);
  for(const raw of database.prepare(`SELECT * FROM "t_${t.name}"`).iterate() as Iterable<Record<string,unknown>>){const problem=rowProblem(database,cols,raw,now,context);if(problem&&(t.name===table||problem!==rowProblem(baseline,oldCols,(oldRow.get(raw.id) as Record<string,unknown>|undefined)||{},now,oldContext)))add(t.label,problem,Number(raw.id));}
 }
 for(const view of database.prepare("SELECT * FROM _views").all() as any[]){try{validateDisplay(JSON.parse(view.display_json),["dashboard","custom"].includes(view.kind)?[]:schema[view.table_name]);if(view.kind==='custom')validateCustomData(JSON.parse(view.display_json).custom_page,database.prepare("SELECT name,table_name FROM _views").all() as any[],database.prepare("SELECT name FROM _actions").all() as any[],schema);validateViewCondition(view.show_if,schema);viewIsVisible(view.show_if,{...context,now});}catch(e){add(`View ${view.label}`, (e as Error).message);}}
 for(const entity of ["_slices","_actions"]){for(const item of database.prepare(`SELECT * FROM ${entity}`).all() as any[]){const expressions=(entity==="_slices"?[item.filter_expr]:[item.condition_expr,...actionConfigExpressions(JSON.parse(item.config_json||"{}")),...Object.values(JSON.parse(item.values_json))]).filter(e=>typeof e==="string"&&e.trim());
  const cols=schema[item.table_name];if(!cols)throw Error("Slice หรือ Action อ้างอิงตารางที่ไม่มีอยู่ กรุณาแก้การตั้งค่า");
  let probe="conversion_check";while(cols.some(c=>c.name===probe))probe+="x";
  assertFormulas([...cols,{name:probe,label:item.label,type:"text",show_if:expressions.map(e=>`(${e})`).join(" + ")}],schema);
  for(const raw of database.prepare(`SELECT * FROM "t_${item.table_name}"`).iterate() as Iterable<Record<string,unknown>>){try{
   const row=calculateRow(cols,raw,false,now,false,"",context).row,options={...context,now,refTables:refTablesOf(cols)};
   for(const expression of expressions)evaluateExpression(String(expression),row,options);
   if(entity==="_actions"&&item.kind==="set")for(const [name,expression] of Object.entries(JSON.parse(item.values_json))){const column=cols.find(c=>c.name===name);if(!column)throw Error("Action อ้างอิงคอลัมน์ที่ไม่มีอยู่");normalizeValue(column,evaluateExpression(String(expression),row,options));}
  }catch(e){add(`${entity==="_slices"?"Slice":"Action"} ${item.label}`,(e as Error).message,Number(raw.id));}}
 }}
}
export function previewConversion(database:Database.Database,table:string,request:ConversionRequest,now=new Date()):ConversionReport{
 const {source,target}=prepare(database,table,request),snapshot=database.serialize();
 // Only the independent snapshot is changed. SQLite deserialize cannot open WAL-mode buffers.
 // SQLite's documented workaround: https://sqlite.org/c3ref/deserialize.html
 snapshot[18]=1;snapshot[19]=1;
 const snapshotDatabase=new Database(snapshot),stage=currentApplication()?applicationDatabase(snapshotDatabase,currentApplication()!.id):snapshotDatabase;
 registerAuditFunctions(snapshotDatabase);
 const report:ConversionReport={allowed:false,total:0,converted:0,failed:0,samples:[],issues:[],warnings:[],source,target,mode:request.mode};
 const values:{id:number;value:unknown}[]=[],resolve=referenceResolver(stage,target,request.ref_match||"id");let timeLoss=0,dateLoss=0;
 try{
  for(const raw of stage.prepare(`SELECT id,"${source.name}" AS value FROM "t_${table}" ORDER BY id`).iterate() as Iterable<{id:number;value:unknown}>){report.total++;try{
   const value=convertValue(source,target,raw.value,resolve);values.push({id:raw.id,value});report.converted++;
   if(report.samples.length<10)report.samples.push({id:raw.id,before:shown(raw.value),after:shown(value)});
   if(target.type==="time"&&source.type==="datetime"&&value!=null)dateLoss++;
   if(target.type==="date"&&typeof raw.value==="string"&&raw.value.includes("T")&&!normalizeDateTime(raw.value).includes("T00:00:00.000"))timeLoss++;
  }catch(e){report.failed++;if(report.issues.length<20)report.issues.push({table,id:raw.id,before:shown(raw.value),message:(e as Error).message});}}
  if(dateLoss)report.warnings.push(`${dateLoss} รายการจะเก็บเฉพาะเวลาไทย ไม่เก็บส่วนวันที่ เลือกคัดลอกไปคอลัมน์ใหม่หากต้องการเก็บวัน–เวลาต้นฉบับ`);
  if(timeLoss)report.warnings.push(`${timeLoss} รายการจะเหลือเฉพาะวันที่ เวลาไม่ถูกเก็บในคอลัมน์ปลายทาง เลือกคัดลอกไปคอลัมน์ใหม่หากต้องการเก็บวัน–เวลาต้นฉบับ`);
  if(request.mode==="replace"&&source.type==="ref"&&(target.type!=="ref"||target.ref_table!==source.ref_table))report.warnings.push("Related และ Inline ของ Ref เดิมจะถูกนำออก ส่วน Ref ใหม่จะสร้าง Inline ให้อัตโนมัติ");
  if(report.failed)return report;
  try{withoutAudit(()=>foreignKeyTransaction(stage,()=>{writeConversion(stage,table,request,source,target,values);checkDependencies(stage,table,report,database,now);validateStoredWorkflows(stage);}));}
  catch(e){report.failed++;const message=(e as Error).message;report.issues.push({table,message:message.includes("UNIQUE")?"แปลงแล้ว Key มีค่าซ้ำ เช่น 01 และ 1 กรุณาแก้ข้อมูลหรือคัดลอกไปคอลัมน์ใหม่":/[ก-๙]/.test(message)?message:"โครงสร้างปลายทางไม่ผ่านการตรวจ กรุณาตรวจ Key และ Ref"});}
  report.allowed=report.failed===0;return report;
 }finally{snapshotDatabase.close();}
}
// Caller must require an unchanged preview and create a backup before invoking this synchronous transaction.
export function applyConversion(database:Database.Database,table:string,request:ConversionRequest,expectedFingerprint?:string){
 const {source,target}=prepare(database,table,request),resolve=referenceResolver(database,target,request.ref_match||"id");
 const values=(database.prepare(`SELECT id,"${source.name}" AS value FROM "t_${table}" ORDER BY id`).all() as {id:number;value:unknown}[]).map(row=>({id:row.id,value:convertValue(source,target,row.value,resolve)}));
 foreignKeyTransaction(database,()=>{
  if(expectedFingerprint&&conversionFingerprint(database,table,request)!==expectedFingerprint)throw Error("ข้อมูลเปลี่ยนหลังตรวจ กรุณาตรวจการแปลงใหม่ก่อนยืนยัน");
  writeConversion(database,table,request,source,target,values);
 });
 return target;
}
