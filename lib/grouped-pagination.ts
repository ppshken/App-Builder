import {booleanLabel} from './boolean-labels';
import {decimalLabel} from './decimal-format';
import {dateLabel,dateTimeLabel} from './datetime';
import {valueLabel} from './value-types';
import {db} from './db';
import type {Column} from './columns';
import type {expressionContext} from './expression-context';
import {withReferenceLabels} from './reference-labels';
import {groupTree,groupAtPath,type GroupLevel,type GroupNode} from './view-groups';
type Row=Record<string,any>;
export function parseGrouping(params:URLSearchParams,cols:Column[]){
 const text=params.get('group_by');if(text===null)return null;
 if(text.length>4000)throw Error('การจัดกลุ่มไม่ถูกต้อง');const levels=JSON.parse(text) as GroupLevel[];
 if(!Array.isArray(levels)||!levels.length||levels.length>5||new Set(levels.map(l=>l?.column)).size!==levels.length||levels.some(l=>!l||!['asc','desc'].includes(l.direction)||l.column!=='id'&&!cols.some(c=>c.name===l.column)))throw Error('จัดกลุ่มได้ไม่เกิน 5 ระดับ กรุณาเลือกคอลัมน์ให้ถูกต้อง');
 const pathText=params.get('group_path')||'[]';if(pathText.length>12000)throw Error('เส้นทางกลุ่มไม่ถูกต้อง');const path=JSON.parse(pathText) as string[];
 if(!Array.isArray(path)||path.length>levels.length||path.some(p=>typeof p!=='string'||p.length>4000))throw Error('เส้นทางกลุ่มไม่ถูกต้อง');
 return {levels,path};
}
function groupLabel(row:Row,column:string,cols:Column[]){const c=cols.find(c=>c.name===column),v=row[column];if(v==null||v==='')return 'ไม่ระบุ';if(c?.type==='ref')return String(row[column+'__label']??'');if(c?.type==='yesno')return booleanLabel(c,v);if(c?.type==='decimal')return decimalLabel(c,v);if(c?.type==='date')return dateLabel(v);if(c?.type==='datetime')return dateTimeLabel(v);if(c&&['price','percent','rating'].includes(c.type))return String(valueLabel(c.type,v));return Array.isArray(v)?v.join(' · '):String(v);}
export function groupingTree(rows:Row[],levels:GroupLevel[],cols:Column[],weighted=false):GroupNode<Row>[] {
 const tree=groupTree(rows,levels,(r,c)=>r[c],(r,c)=>groupLabel(r,c,cols),c=>cols.find(col=>col.name===c)?.type!=='ref');
 const summarize=(nodes:GroupNode<Row>[]):GroupNode<Row>[]=>nodes.map(n=>({...n,count:n.rows.reduce((sum,r)=>sum+(weighted?Number(r.__group_count):1),0),rows:n.rows.slice(0,1),children:summarize(n.children)}));
 return summarize(tree);
}
export function groupLeaves<T>(tree:GroupNode<T>[]):GroupNode<T>[]{return tree.flatMap(n=>n.children.length?groupLeaves(n.children):[n]);}
export function sqlGroupingSupported(levels:GroupLevel[],cols:Column[]){return levels.every(l=>l.column==='id'||cols.some(c=>c.name===l.column&&!c.is_virtual&&['text','longtext','number','decimal','ref','yesno'].includes(c.type)));}
export function groupedSqlPage(table:string,cols:Column[],levels:GroupLevel[],path:string[],where:string,args:any[],sort:string,direction:string,requested:number,size:number,now:Date,email:string,context:ReturnType<typeof expressionContext>){
 // Identifiers come only from validated column metadata. All values are bound.
 const fields=levels.map(l=>'"'+l.column+'"').join(',');
 let summaries=db.prepare('SELECT '+fields+',COUNT(*) __group_count,MIN(id) id FROM "t_'+table+'" WHERE '+where+' GROUP BY '+fields).all(...args) as Row[];
 summaries=withReferenceLabels(table,cols.filter(c=>levels.some(l=>l.column===c.name)),summaries,now,email,context);
 const groups=groupingTree(summaries,levels,cols,true),selected=groupAtPath(groups,path),validPath=selected?path:[],leaves=groupLeaves(selected?[selected]:groups),total=leaves.reduce((sum,n)=>sum+(n.count||0),0),page=Math.min(requested,Math.max(1,Math.ceil(total/size)));
 let skip=(page-1)*size,remaining=size;const rows:Row[]=[];
 for(const leaf of leaves){const count=leaf.count||0;if(skip>=count){skip-=count;continue;}if(!remaining)break;
  const values:any[]=[],conditions=leaf.path.map((key,i)=>{const value=JSON.parse(key),column='"'+levels[i].column+'"';if(value===null)return '('+column+" IS NULL OR "+column+"='')";values.push(value);return column+' IS ?';});
  const take=Math.min(remaining,count-skip);
  rows.push(...db.prepare('SELECT * FROM "t_'+table+'" WHERE ('+where+') AND '+conditions.join(' AND ')+' ORDER BY "'+sort+'" '+direction+',id '+direction+' LIMIT ? OFFSET ?').all(...args,...values,take,skip) as Row[]);
  remaining-=take;skip=0;
 }
 return {rows,total,page,groups,group_path:validPath,group_total:groups.reduce((sum,n)=>sum+(n.count||0),0)};
}
export function groupedMemoryPage(rows:Row[],levels:GroupLevel[],path:string[],cols:Column[],requested:number,size:number){
 const complete=groupTree(rows,levels,(r,c)=>r[c],(r,c)=>groupLabel(r,c,cols),c=>cols.find(col=>col.name===c)?.type!=='ref'),selected=groupAtPath(complete,path),matched=groupLeaves(selected?[selected]:complete).flatMap(n=>n.rows),total=matched.length,page=Math.min(requested,Math.max(1,Math.ceil(total/size)));
 return {rows:matched.slice((page-1)*size,page*size),total,page,groups:groupingTree(rows,levels,cols),group_path:selected?path:[],group_total:rows.length};
}
