import {db,columnsOf,tableExists} from './db';
import {AuthError} from './auth';
import {assertTablePermission,currentAccess,currentUser} from './permissions';
import {visibleRawRows} from './row-access';
import {checkFormula,matches} from './automation';
import {sliceSql} from './slice-sql';
import {calculateRow} from './columns';
import {references} from './expression';
import {expressionContext} from './expression-context';
import {referenceLabelColumns} from './reference-labels';
import {withReferenceLabels} from './view-records';
export function previewSlice(input:Record<string,any>){
 if(!currentAccess().builder)throw new AuthError('ผู้พัฒนาแอปเท่านั้นที่ดูตัวอย่าง Slice ได้',403);
 const started=performance.now(),table=input.table_name;if(!tableExists(table))throw new AuthError('ไม่พบตารางต้นทางในแอปนี้',404);assertTablePermission(table,'read');
 const cols=columnsOf(table),source=checkFormula(table,input.filter_expr),names=new Set(cols.map(c=>c.name));
 if(!Array.isArray(input.columns)||input.columns.length>200||input.columns.some((n:unknown)=>typeof n!=='string'||!names.has(n)))throw Error('คอลัมน์ Slice ไม่ถูกต้อง');
 const allowed=input.columns.length?[...new Set(input.columns)] as string[]:cols.map(c=>c.name),requested=input.preview_columns??allowed.filter(n=>n!=='id').slice(0,8);
 if(!Array.isArray(requested)||requested.length>8||requested.some((n:unknown)=>typeof n!=='string'||(!allowed.includes(n)||n==='id')))throw Error('เลือกคอลัมน์ตัวอย่างได้ไม่เกิน 8 คอลัมน์จาก Slice นี้');
 const cursor=input.cursor??0;if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('ตำแหน่งข้อมูลตัวอย่างไม่ถูกต้อง');
 const now=new Date(),email=currentUser()?.email||'',context={...expressionContext(now,email),tableName:table},plan=sliceSql(source,cols,email),filterCols=referenceLabelColumns(cols,references(source)),display=referenceLabelColumns(cols,requested),physical=[...new Set(['id',...[...filterCols,...display].filter(c=>!c.is_virtual).map(c=>c.name)])].map(n=>'"'+n+'"').join(',');
 return db.transaction(()=>{
  const sourceTotal=(db.prepare('SELECT COUNT(*) n FROM "t_'+table+'"').get() as {n:number}).n;
  const total=plan?(db.prepare('SELECT COUNT(*) n FROM "t_'+table+'" WHERE '+plan.where).get(...plan.args) as {n:number}).n:null;
  const scanStarted=performance.now(),found:Record<string,any>[]= [];let after=cursor,scanned=0,exhausted=false;
  while(found.length<11&&scanned<500&&(scanned===0||performance.now()-scanStarted<300)){
   const batch=db.prepare('SELECT '+physical+' FROM "t_'+table+'" WHERE id>?'+(plan?' AND ('+plan.where+')':'')+' ORDER BY id LIMIT ?').all(after,...(plan?.args||[]),plan?11:50) as Record<string,any>[];
   if(!batch.length){exhausted=true;break;}const visible=new Set(visibleRawRows(table,batch).map(r=>r.id));let consumed=0;
   for(const raw of batch){if(scanned>=500||scanned>0&&performance.now()-scanStarted>=300)break;after=Number(raw.id);scanned++;consumed++;if(!visible.has(raw.id))continue;const row=calculateRow(filterCols,raw,false,now,true,email,context).row;if(matches(source,row,email,table,context))found.push(raw);if(found.length===11)break;}
   if(found.length===11)break;if(consumed===batch.length&&batch.length<(plan?11:50)){exhausted=true;break;}
  }
  const extra=found.length>10;if(extra)found.pop();const nextCursor=extra?Number(found[found.length-1].id):exhausted?null:after;
  const rows=found.map(raw=>{const calculated=calculateRow(display,raw,false,now,true,email,context);return {...calculated.row,__errors:calculated.errors};});
  const labelled=withReferenceLabels(table,display,rows,now,email,context);
  return {rows:labelled.map(row=>Object.fromEntries(['id','__errors',...requested,...requested.map(n=>n+'__label')].filter(n=>Object.hasOwn(row,n)).map(n=>[n,row[n]]))),columns:requested.map(n=>{const c=cols.find(c=>c.name===n)!;return {name:c.name,label:c.label,type:c.type};}),sourceTotal,total,scanned,nextCursor,duration_ms:Math.round((performance.now()-started)*100)/100,strategy:plan?'sql':'scan',read_only:true};
 })();
}
