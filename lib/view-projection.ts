import {listCardReferences} from './list-card';
import {customExpressions} from './custom-page';
import {labelTextColumn,labelImageColumn,type Column} from './columns';
import {references,parseExpression,tableReferences,referencePaths} from './expression';
import {displaySettings,type ViewDisplay} from './view-display';
import {visibleColumns,type AppView} from './views';
// This is a workload selection, never an access-control boundary.
export function projectionColumns(columns:Column[],names:string[],sources:string[]=[]){
 const needed=new Set(['id',...names,labelTextColumn(columns),labelImageColumn(columns),...columns.filter(c=>c.is_key).map(c=>c.name)].filter(Boolean) as string[]);
 for(const source of sources)if(source?.trim())for(const ref of references(source))needed.add(ref);
 for(const name of needed){const c=columns.find(c=>c.name===name);if(c?.is_virtual&&c.virtual_expr)for(const ref of references(c.virtual_expr))needed.add(ref);}
 return columns.filter(c=>needed.has(c.name));
}
export function parseProjection(value:string|null,columns:Column[]){
 if(value===null)return undefined;if(value.length>20000)throw Error('รายการคอลัมน์ยาวเกินไป');const names=JSON.parse(value);
 if(!Array.isArray(names)||names.length>200||names.some(n=>typeof n!=='string'||n!=='id'&&!columns.some(c=>c.name===n)))throw Error('คอลัมน์ที่ต้องการโหลดไม่ถูกต้อง');return names as string[];
}
export function runtimeFields(columns:Column[],view:AppView|undefined,defaults:Partial<ViewDisplay>,actions:{condition_expr:string}[],sliceColumns:string[]=[]):string[]|undefined{
 if(!view||!['table','list'].includes(view.kind))return;
 const source=visibleColumns(columns,sliceColumns),shown=visibleColumns(source,view.columns),display=displaySettings(view.display,defaults),names=new Set<string>();
 // Table views also render mobile cards, so include both presentations.
 if(view.kind==='table')shown.forEach(c=>names.add(c.name));
 const title=display.title_column==='__auto__'?labelTextColumn(columns):display.title_column;if(title)names.add(title);
 if(display.image_column&&display.image_column!=='__auto__')names.add(display.image_column);
 const summaries=display.summary_columns===null?shown.filter(c=>!c.is_label&&c.type!=='image').slice(0,3):visibleColumns(source,display.summary_columns).filter(c=>display.summary_columns!.includes(c.name));summaries.forEach(c=>names.add(c.name));
 // Settings contain column selectors and formatting expressions. Parse only
 // expressions; ordinary labels/text are ignored.
 const expressions:string[]=display.list_card_enabled?customExpressions(display.list_card):[];const visit=(v:unknown)=>{if(typeof v==='string'){if(columns.some(c=>c.name===v))names.add(v);try{for(const ref of references(v))names.add(ref);}catch{}}else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};if(view.group_column)names.add(view.group_column);visit(display.group_by);if(display.group_summary==='sum'&&display.group_sum_column)names.add(display.group_sum_column);visit(display.tabs_column);visit(display.filter_columns);
 if(display.list_card_enabled)listCardReferences(display.list_card).forEach(name=>names.add(name));
 for(const [column,style]of Object.entries(display.data_styles||{}))if(names.has(column))for(const rule of style.rules||[])expressions.push(rule.condition);
 actions.forEach(a=>expressions.push(a.condition_expr));const selected=projectionColumns(columns,[...names],expressions);
 const fields=selected.map(c=>c.name).sort();return selected.length>=columns.length||selected.length>200||encodeURIComponent(JSON.stringify(fields)).length>2500?undefined:fields;
}

export function viewExpressionSources(value:unknown):string[]{const result=new Set<string>();const visit=(v:unknown)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const [key,item]of Object.entries(v)){if(['condition','condition_expr'].includes(key)&&typeof item==='string')try{parseExpression(item);if(tableReferences(item).length||referencePaths(item).length)result.add(item);}catch{}else visit(item);}};visit(value);return [...result];}
