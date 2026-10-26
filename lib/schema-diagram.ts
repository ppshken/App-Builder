import type {Column} from './columns';
export type DiagramTable={name:string;label:string;owner_app_id?:string;columns:Column[]};
export type DiagramEdge={id:string;source:string;target:string;column:Column;available:boolean;physical:boolean};
export type Point={x:number;y:number};
export const CARD_WIDTH=276, ROW_HEIGHT=32;
export function diagramEdges(tables:DiagramTable[]):DiagramEdge[]{const names=new Set(tables.map(t=>t.name));return tables.flatMap(t=>t.columns.filter(c=>c.ref_table&&['ref','list','enum','enumlist'].includes(c.type)).map(c=>({id:t.name+':'+c.name,source:t.name,target:c.ref_table!,column:c,available:names.has(c.ref_table!),physical:c.type==='ref'&&!c.is_virtual})));}
export function visibleColumns(table:DiagramTable,expanded=false){return expanded?table.columns:table.columns.slice(0,10);}
export function cardHeight(table:DiagramTable,expanded=false){return 110+visibleColumns(table,expanded).length*ROW_HEIGHT+(table.columns.length>10?34:0);}
/** Breadth-first components handle cycles without recursive dependency traversal. */
export function layoutDiagram(tables:DiagramTable[],edges:DiagramEdge[],expanded:Record<string,boolean>={}):Record<string,Point>{
 const positions:Record<string,Point>={},adj=new Map(tables.map(t=>[t.name,new Set<string>()])),byName=new Map(tables.map(t=>[t.name,t]));
 for(const e of edges)if(e.available&&e.source!==e.target){adj.get(e.source)?.add(e.target);adj.get(e.target)?.add(e.source);}
 let baseY=28;
 for(const root of tables){if(positions[root.name])continue;const queue=[{name:root.name,level:0}],seen=new Set([root.name]),bottoms:number[]=[];let cursor=0;
 while(cursor<queue.length){const {name,level}=queue[cursor++];const y=bottoms[level]??baseY;positions[name]={x:28+level*370,y};bottoms[level]=y+cardHeight(byName.get(name)!,expanded[name])+48;
 for(const next of adj.get(name)??[])if(!positions[next]&&!seen.has(next)){seen.add(next);queue.push({name:next,level:level+1});}}
 baseY=Math.max(...bottoms)+28;
 }return positions;
}
