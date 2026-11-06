import type {ViewDisplay} from './view-display';
export const DASHBOARD_PANEL_SIZES=[['small','เล็ก'],['wide','กว้าง'],['tall','สูง'],['large','ใหญ่']] as const;
export type DashboardPanelSize=typeof DASHBOARD_PANEL_SIZES[number][0];
export function validateDashboardLayout(d:ViewDisplay){
 if(d.dashboard_mobile_tabs!==undefined&&typeof d.dashboard_mobile_tabs!=='boolean')throw Error('แท็บมือถือของแดชบอร์ดต้องเป็นเปิดหรือปิด');
 if(d.dashboard_min_width!==undefined&&(!Number.isInteger(d.dashboard_min_width)||d.dashboard_min_width<240||d.dashboard_min_width>640))throw Error('ความกว้างขั้นต่ำของช่องแดชบอร์ดต้องเป็นจำนวนเต็ม 240–640');
 if(d.dashboard_panel_sizes!==undefined){const sizes=d.dashboard_panel_sizes;if(!sizes||typeof sizes!=='object'||Array.isArray(sizes)||Object.keys(sizes).length>8||Object.entries(sizes).some(([name,size])=>! /^[a-z][a-z0-9_]{0,40}$/.test(name)||!DASHBOARD_PANEL_SIZES.some(([key])=>key===size)))throw Error('ขนาดช่องแดชบอร์ดไม่ถูกต้อง');}
}
export function dashboardLayout(d:ViewDisplay,width:number){
 const mobile=width<=600,requested=d.dashboard_layout||'stack',mode=mobile&&d.dashboard_mobile_tabs?'tabs':requested==='auto'?'grid':requested;
 const max=d.dashboard_columns||2,gap=d.dashboard_gap??16,min=d.dashboard_min_width??320;
 const columns=mode!=='grid'?1:requested==='auto'?Math.max(1,Math.min(max,Math.floor((Math.max(0,width)+gap)/(min+gap)))):width<=760?1:max;
 return {mode,columns,mobile};
}
export function dashboardPanelSpan(size:DashboardPanelSize|undefined,layout:ReturnType<typeof dashboardLayout>){
 if(layout.mode!=='grid'||layout.mobile)return {columns:1,rows:1};
 return {columns:Math.min(layout.columns,size==='wide'||size==='large'?2:1),rows:size==='tall'||size==='large'?2:1};
}
