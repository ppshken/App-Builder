import type {CSSProperties} from 'react';
export type CustomGrid={columns?:number;tabletColumns?:number;mobileColumns?:number;rowGap?:number;verticalAlign?:'start'|'center'|'end'|'stretch'};
export type CustomGridSpan={span?:number;tabletSpan?:number;mobileSpan?:number};
export function customGridColumns(grid:CustomGrid){const desktop=grid.columns||1;return {desktop,tablet:grid.tabletColumns??Math.min(desktop,2),mobile:grid.mobileColumns??1};}
export function customGridStyle(grid:CustomGrid):CSSProperties{if(!grid.columns)return {};const c=customGridColumns(grid);return {'--custom-grid-desktop':c.desktop,'--custom-grid-tablet':c.tablet,'--custom-grid-mobile':c.mobile,alignItems:grid.verticalAlign||'stretch'} as CSSProperties;}
export function customGridSpanStyle(node:CustomGridSpan,parent?:CustomGrid):CSSProperties{if(!parent?.columns)return {};const c=customGridColumns(parent);return {'--custom-span-desktop':Math.min(node.span||1,c.desktop),'--custom-span-tablet':Math.min(node.tabletSpan??node.span??1,c.tablet),'--custom-span-mobile':Math.min(node.mobileSpan??1,c.mobile)} as CSSProperties;}
export function validateCustomGrid(value:Record<string,unknown>,node=false){
 for(const key of ['columns','tabletColumns','mobileColumns',...(node?['span','tabletSpan','mobileSpan']:[])])if(value[key]!==undefined&&(typeof value[key]!=='number'||!Number.isInteger(value[key])||(value[key] as number)<1||(value[key] as number)>12))throw Error('จำนวนคอลัมน์และความกว้างต้องเป็นจำนวนเต็ม 1–12 ช่อง');
 if(value.rowGap!==undefined&&(typeof value.rowGap!=='number'||!Number.isInteger(value.rowGap)||value.rowGap<0||value.rowGap>80))throw Error('ระยะห่างแถวต้องอยู่ระหว่าง 0–80 พิกเซล');
 if(value.verticalAlign!==undefined&&!['start','center','end','stretch'].includes(String(value.verticalAlign)))throw Error('การจัดแนว Grid ไม่ถูกต้อง');
}
