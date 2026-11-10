"use client";
import {useDashboardLayout} from './useDashboardLayout';
import {dashboardPanelSpan} from '@/lib/dashboard-layout';
import CustomRuntimeView from './CustomRuntimeView';
import Icon from './Icon';
import {useEffect,useState} from 'react';import RuntimeTable from './RuntimeTable';import SpecialRuntimeView from './SpecialRuntimeView';import {AppView} from '@/lib/views';import {useAppSettings} from './AppSettingsProvider';import {displaySettings} from '@/lib/view-display';
type Props=React.ComponentProps<typeof RuntimeTable>&{views:AppView[];dataRevision?:number};
function Dashboard(props:Props){
 const v=props.runtimeView!,{settings}=useAppSettings(),d=displaySettings(v.display,settings.display_defaults.dashboard),layout=useDashboardLayout(d),[tab,setTab]=useState(''),[search,setSearch]=useState('');
 const children=d.dashboard_views.flatMap(name=>{const found=props.views.find(x=>x.name===name&&['list','table','map','chart','calendar'].includes(x.kind)&&x.position!=='inline');return found?[found]:[];});
 const selected=children.find(x=>x.name===tab)||children[0];
 useEffect(()=>props.onReady?.(),[props.onReady]);useEffect(()=>{props.onScreenChange?.(v.name,false);},[v.name,props.onScreenChange]);
 return <section ref={layout.ref} className="dashboard-view" aria-label={v.label} data-dashboard-layout={layout.mode} data-dashboard-columns={layout.columns}>
 <div className="dashboard-search search-box"><Icon name="search"/><input aria-label="ค้นหาทุก View ใน Dashboard" placeholder="ค้นหาข้อมูลทุก View ใน Dashboard…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 {!children.length&&<p className="empty-state">ยังไม่มีหน้าที่แสดงได้ กรุณาเลือก View และตรวจสิทธิ์หรือ Show_If</p>}
 {layout.mode==='tabs'&&<nav className="dashboard-tabs" aria-label="หน้าในแดชบอร์ด">{children.map(x=><button key={x.name} aria-current={selected?.name===x.name?'page':undefined} onClick={()=>setTab(x.name)}>{x.label}</button>)}</nav>}
 <div className={'dashboard-panels layout-'+layout.mode} style={{gap:d.dashboard_gap,gridTemplateColumns:`repeat(${layout.columns},minmax(0,1fr))`,height:(!layout.mobile||layout.mode==='tabs')&&layout.availableHeight>0?layout.availableHeight:undefined,gridAutoRows:(!layout.mobile||layout.mode==='tabs')?`minmax(${d.dashboard_height}px,1fr)`:d.dashboard_height+'px'} as React.CSSProperties}>
 {(layout.mode==='tabs'?(selected?[selected]:[]):children).map(child=>{const span=dashboardPanelSpan(d.dashboard_panel_sizes[child.name],layout);return <article className="dashboard-panel" key={child.name} data-dashboard-panel={child.name} style={{height:'100%',gridColumn:'span '+span.columns,gridRow:'span '+span.rows}}>
 <header className="dashboard-panel-heading"><button type="button" className="dashboard-panel-title" onClick={()=>props.onNavigate?.(child)} title={child.label}>{child.label}</button><button type="button" className="icon-button dashboard-panel-expand" aria-label={`เปิด View ${child.label}`} title={`เปิดหน้า ${child.label}`} onClick={()=>props.onNavigate?.(child)}><Icon name="expand" width="18" height="18"/></button></header>
 <div className="dashboard-panel-body"><RuntimeViewRenderer {...props} dashboardSearch={search} onNavigate={(next,id,values)=>props.onNavigate?.(next,id,values,v)} onOpenReference={(table,id,kind)=>props.onOpenReference?.(table,id,kind,v)} table={child.table_name} runtimeView={child} initialRow={undefined} initialValues={undefined} onReady={undefined} registerNavigationGuard={undefined} onScreenChange={undefined}/></div>
 </article>;})}</div></section>;
}

export default function RuntimeViewRenderer(props:Props){return props.runtimeView?.kind==='custom'?<CustomRuntimeView {...props} renderEmbedded={child=><RuntimeViewRenderer {...props} table={child.table_name} runtimeView={child} initialRow={undefined} initialValues={undefined} onReady={undefined} registerNavigationGuard={undefined} onScreenChange={undefined} onNavigate={(next,id,values)=>props.onNavigate?.(next,id,values,props.runtimeView)} onOpenReference={(table,id,kind)=>props.onOpenReference?.(table,id,kind,props.runtimeView)}/>}/>:  props.runtimeView?.kind==='dashboard'?<Dashboard {...props}/>:['map','chart','calendar'].includes(props.runtimeView?.kind||'')?<SpecialRuntimeView {...props}/>:<RuntimeTable {...props}/>;}
