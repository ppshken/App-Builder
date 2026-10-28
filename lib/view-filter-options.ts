import {db,columnsOf,tableExists} from './db';
import {canQuickFilter} from './view-filter-config';
import {assertTablePermission} from './permissions';
import {hasRowRule,rowAllowed} from './row-access';
import {sliceFor,matches} from './automation';
import {calculateRow} from './columns';
import {expressionContext} from './expression-context';
import {parseFilters,filterSql} from './data-filters';
import {withReferenceLabels} from './reference-labels';
import {userFieldOptions} from './user-fields';
import {dateLabel,dateTimeLabel} from './datetime';
import {valueLabel} from './value-types';
export function viewFilterOptions(table:string,params:URLSearchParams,email=''){
 assertTablePermission(table,'read');if(!tableExists(table))throw Error('ไม่พบตาราง');const cols=columnsOf(table),c=cols.find(c=>c.name===params.get('options_for'));if(!c||!canQuickFilter(c))throw Error('คอลัมน์นี้ใช้เป็น Filter แบบ dropdown ไม่ได้');const slice=sliceFor(params.get('slice'),table);if(slice?.columns.length&&!slice.columns.includes(c.name))throw Error('คอลัมน์นี้ไม่ได้อยู่ใน Slice');const query=(params.get('option_q')||'').trim().toLocaleLowerCase();if(query.length>200)throw Error('คำค้นหาตัวเลือกยาวเกิน 200 ตัวอักษร');const filters=parseFilters(params.get('filters'),cols);if(filters.some(f=>!canQuickFilter(cols.find(c=>c.name===f.column)!)))throw Error('ตัวกรองขอบเขตต้องเป็นคอลัมน์ค่าเดี่ยว');const where=filterSql(filters,cols),slow=hasRowRule(table)||!!slice,now=new Date(),context=expressionContext(now,email),users=c.type==='user'?new Map(userFieldOptions().map(u=>[u.id,u.nickname?u.nickname+' · '+u.name:u.name])):new Map<number,string>();
 const options:{value:string;label:string}[]=[],seen=new Set<string>();let batch:Record<string,any>[]=[],empty=false,truncated=false;
 const flush=()=>{if(c.type==='ref')withReferenceLabels(table,[c],batch,now,email,context);for(const row of batch){const v=row[c.name];if(v==null||v===''){empty=true;continue;}const raw=String(v);if(!raw.trim()||raw.length>2000)continue;const label=c.type==='ref'?String(row[c.name+'__label']??'ข้อมูลอ้างอิง #'+raw):c.type==='user'?users.get(Number(v))||'ผู้ใช้ #'+raw:c.type==='yesno'?(Number(v)?'ใช่':'ไม่ใช่'):c.type==='date'?dateLabel(v):c.type==='datetime'?dateTimeLabel(v):['price','percent','rating'].includes(c.type)?valueLabel(c.type,v):raw;if(!label.toLocaleLowerCase().includes(query)||seen.has(raw))continue;seen.add(raw);if(options.length===500){truncated=true;break;}options.push({value:raw,label});}batch=[];};
 const sql='SELECT '+(slow?'*':'DISTINCT "'+c.name+'"')+' FROM "t_'+table+'" WHERE '+where.where+' ORDER BY "'+c.name+'"';
 for(const raw of db.prepare(sql).iterate(...where.args) as Iterable<Record<string,any>>){if(slow&&!rowAllowed(table,raw,'read'))continue;if(slice&&!matches(slice.filter_expr,calculateRow(cols,raw,false,now,true,email,context).row,email,table,context))continue;batch.push(raw);if(batch.length>=100){flush();if(truncated)break;}}if(!truncated&&batch.length)flush();return {options,empty,truncated};
}
