import type {AppView} from './views';
export type GroupLevel={column:string;direction:'asc'|'desc'};
export function viewGroups(view?:Pick<AppView,'group_column'|'group_dir'|'display'>):GroupLevel[]{return view?.display?.group_by?.length?view.display.group_by:view?.group_column?[{column:view.group_column,direction:view.group_dir==='desc'?'desc':'asc'}]:[];}
export type GroupNode<T>={key:string;column:string;label:string;value:unknown;rows:T[];children:GroupNode<T>[];path:string[]};
export function groupTree<T>(rows:T[],levels:GroupLevel[],value:(row:T,column:string)=>unknown,label:(row:T,column:string)=>string,numeric:(column:string)=>boolean,depth=0,path:string[]=[]):GroupNode<T>[]{
 if(depth>=levels.length)return [];const level=levels[depth],map=new Map<string,GroupNode<T>>();
 for(const row of rows){const v=value(row,level.column),empty=v==null||v===''||Array.isArray(v)&&!v.length,key=JSON.stringify(empty?null:v);let node=map.get(key);if(!node){node={key:JSON.stringify([...path,key]),column:level.column,label:empty?'ไม่ระบุ':label(row,level.column),value:v,rows:[],children:[],path:[...path,key]};map.set(key,node);}node.rows.push(row);}
 return [...map.values()].sort((a,b)=>(numeric(level.column)&&typeof a.value==='number'&&typeof b.value==='number'?a.value-b.value:a.label.localeCompare(b.label,'th',{numeric:true}))*(level.direction==='desc'?-1:1)).map(n=>({...n,children:groupTree(n.rows,levels,value,label,numeric,depth+1,n.path)}));
}
export function groupAtPath<T>(tree:GroupNode<T>[],path:string[]):GroupNode<T>|undefined{let found:GroupNode<T>|undefined;for(const key of path){found=tree.find(n=>n.path[n.path.length-1]===key);if(!found)return;tree=found.children;}return found;}
