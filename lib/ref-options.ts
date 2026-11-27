import {db,columnsOf,tableExists} from './db';
import {assertTablePermission} from './permissions';
import {visibleRawRows,hasRowRule} from './row-access';
import {calculateRow,labelTextColumn,labelImageColumn} from './columns';
import {referenceLabelColumns} from './reference-labels';
import {expressionContext} from './expression-context';
import {AuthError} from './auth';

// Cursor is the last examined stable ID, not an offset into a changing result set.
// allowedIds only narrows choices; it never grants read access or replaces save validation.
export function referenceOptions(table:string,input:Record<string,unknown>,email=''){
 assertTablePermission(table,'read');if(!tableExists(table))throw new AuthError('ไม่พบตารางอ้างอิง',404);
 const query=input.query??'',cursor=input.cursor??0,pageSize=input.pageSize??25,searchIds=input.searchIds===true;
 const ids=(value:unknown,max:number):string[]=>{if(!Array.isArray(value)||value.length>max||!value.every(id=>typeof id==='string'&&/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id))))throw new AuthError('รหัสตัวเลือกไม่ถูกต้อง');return value;};
 const selected=ids(input.selectedIds??[],20),allowed=input.allowedIds===undefined?undefined:ids(input.allowedIds,10000);
 if(typeof query!=='string'||query.length>200||!Number.isSafeInteger(cursor)||Number(cursor)<0)throw new AuthError('คำค้นหาหรือรหัสตัวเลือกไม่ถูกต้อง');
 if(![10,25].includes(pageSize as number)||input.searchIds!==undefined&&typeof input.searchIds!=='boolean'||input.includeImages!==undefined&&typeof input.includeImages!=='boolean')throw new AuthError('จำนวนรายการหรือรูปแบบตัวเลือกไม่ถูกต้อง');
 const limit=Number(pageSize),cols=columnsOf(table),label=labelTextColumn(cols),image=input.includeImages===false?'':labelImageColumn(cols),projected=referenceLabelColumns(cols,[label,...image?[image]:[]]),now=new Date(),context=expressionContext(now,email);
 const convert=(raw:Record<string,any>)=>{const {row}=calculateRow(projected,raw,false,now,true,email,context);return {id:Number(raw.id),__label:String(row[label]??raw.id),__image:image?row[image]??null:null};};
 const fullRows=hasRowRule(table),fields=[...new Set(['id',...projected.filter(column=>!column.is_virtual).map(column=>column.name)])].map(name=>'"'+name.replaceAll('"','""')+'"');
 const selectedRows=selected.length?visibleRawRows(table,db.prepare('SELECT '+(fullRows?'*':fields.join(','))+' FROM "t_'+table+'" WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').all(JSON.stringify(selected)) as Record<string,any>[]).map(convert):[];
 if(input.selectedOnly===true)return {rows:[],selected:selectedRows,nextCursor:null};
 const physical=label==='id'||cols.some(c=>c.name===label&&!c.is_virtual),order=allowed===undefined?'t.id':'CAST(choices.key AS INTEGER)+1',args:any[]=allowed===undefined?[cursor]:[JSON.stringify([...new Set(allowed)]),cursor];let where=order+'>?';
 const from='"t_'+table+'" t'+(allowed===undefined?'':' JOIN json_each(?) choices ON t.id=choices.value');
 const exactId=searchIds&&/^[1-9]\d*$/.test(query.trim())&&Number.isSafeInteger(Number(query.trim()));
 const sqlSearch=exactId||physical&&/^[\x00-\x7f]*$/.test(query);
 if(exactId){where+=' AND t.id=?';args.push(Number(query.trim()));}
 else if(query.trim()&&sqlSearch){where+=' AND instr(lower(CAST(t."'+label+'" AS TEXT)),lower(?))>0';args.push(query.trim());}
 const rows:ReturnType<typeof convert>[]=[],positions=new Map<number,number>(),batch=limit===10?11:100;let after=Number(cursor),examined=0,exhausted=false;
 // Bound each request's work even for sparse row policies or computed labels.
 while(rows.length<limit+1&&examined<2000){args[allowed===undefined?0:1]=after;const raw=db.prepare('SELECT '+(fullRows?'t.*':fields.map(field=>'t.'+field).join(','))+', '+order+' AS __choice_cursor FROM '+from+' WHERE '+where+' ORDER BY '+order+' LIMIT ?').all(...args,batch) as Record<string,any>[];
  if(!raw.length){exhausted=true;break;}
  const permitted=new Set(visibleRawRows(table,raw).map(r=>r.id));
  for(const record of raw){if(examined>=2000)break;after=Number(record.__choice_cursor);examined++;if(!permitted.has(record.id))continue;const row=convert(record);if(!sqlSearch&&query.trim()&&!row.__label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(!searchIds||String(row.id)!==query.trim()))continue;rows.push(row);positions.set(row.id,after);if(rows.length===limit+1)break;}
  if(rows.length===limit+1)break;if(raw.length<batch&&examined<2000){exhausted=true;break;}
 }
 // The extra visible match proves another page exists; do not skip it in the cursor.
 const hasExtra=rows.length>limit;if(hasExtra)rows.pop();const nextCursor=hasExtra?positions.get(rows[rows.length-1].id)!:exhausted?null:after;
 return {rows,selected:selectedRows,nextCursor};
}
