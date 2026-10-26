import {db,columnsOf,tableExists} from './db';
import {assertTablePermission,currentAccess,currentUser,canRead} from './permissions';
import {AuthError} from './auth';
import {visibleRawRows} from './row-access';
import {calculateRow} from './columns';
import {evaluateExpression} from './expression';
import {expressionContext} from './expression-context';
import {refTablesOf} from './columns';
export function performanceReport(table?:string){
 if(!currentAccess().builder)throw new AuthError('ส่วนนี้สำหรับผู้สร้างแอพ',403);
 const tables=(db.prepare('SELECT name,label FROM _tables ORDER BY name').all() as {name:string;label:string}[]).filter(t=>canRead(t.name));
 if(!table)return {tables};
 if(!/^[a-z][a-z0-9_]{0,40}$/.test(table)||!tableExists(table))throw new AuthError('ไม่พบตาราง',404);
 assertTablePermission(table,'read');
 const started=performance.now(),now=new Date(),email=currentUser()?.email||'',cols=columnsOf(table),context=expressionContext(now,email);
 const readStart=performance.now(),rows=visibleRawRows(table,db.prepare('SELECT * FROM "t_'+table+'" ORDER BY id LIMIT 10').all() as Record<string,any>[]),readMs=performance.now()-readStart;
 const fields=['virtual_expr','default_expr','valid_if','show_if','required_if','editable_if'] as const;
 const allFormulas=cols.flatMap(c=>fields.flatMap(field=>c[field]?.trim()?[{column:c.name,label:c.label,field,source:c[field]!,count:0,errors:0,total_ms:0,max_ms:0}]:[]));
 const formulas=allFormulas.slice(0,50);
 let limited=false,evaluations=0,calculatedRows=0,calculationMs=0;
 for(const raw of rows){
  if(performance.now()-started>2000){limited=true;break;}
  const start=performance.now(),calculated=calculateRow(cols,raw,false,now,true,email,context);calculationMs+=performance.now()-start;calculatedRows++;
  for(const f of formulas){if(evaluations>=200||performance.now()-started>2000){limited=true;break;}
   const t=performance.now();try{evaluateExpression(f.source,{...calculated.row,_THIS:calculated.row[f.column]},{...context,now,userEmail:email,columnTypes:Object.fromEntries(cols.map(c=>[c.name,c.type])),refTables:refTablesOf(cols),referenceListTable:f.field==='valid_if'&&cols.find(c=>c.name===f.column)?.type==='list'?cols.find(c=>c.name===f.column)?.ref_table||undefined:undefined});}catch{f.errors++;}
   const duration=performance.now()-t;f.count++;evaluations++;f.total_ms+=duration;f.max_ms=Math.max(f.max_ms,duration);
  }if(limited)break;
 }
 const automation=currentAccess().owner?db.prepare("SELECT label,status,created_at,updated_at FROM _automation_jobs WHERE table_name=? ORDER BY created_at DESC LIMIT 50").all(table) as {label:string;status:string;created_at:number;updated_at:number}[]:null;
 return {table,label:tables.find(t=>t.name===table)?.label||table,checked_at:now.toISOString(),sample_rows:rows.length,calculated_rows:calculatedRows,limited:limited||allFormulas.length>50,read_ms:readMs,calculation_ms:calculationMs,total_ms:performance.now()-started,evaluations,formulas:formulas.map(({source,...f})=>({...f,average_ms:f.count?f.total_ms/f.count:0})).sort((a,b)=>b.total_ms-a.total_ms),automation:automation?.map(j=>({label:j.label,status:j.status,elapsed_ms:Math.max(0,(['queued','running'].includes(j.status)?Date.now():j.updated_at)-j.created_at)}))??null};
}
