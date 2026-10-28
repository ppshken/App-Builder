"use client";
import './map-view.css';
import RecordLabel from './RecordLabel';
import Icon from './Icon';
import {useAuth} from './AuthProvider';
import {appResourceUrl} from '@/lib/pwa';
import {useImagePreview} from './ImagePreviewProvider';
import {useEffect,useMemo,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import type {DataRow} from '@/lib/special-view-data';
import {mapPoints} from '@/lib/special-view-data';
import type {ViewDisplay} from '@/lib/view-display';
import type {Map as LeafletMap,Marker} from 'leaflet';
export default function MapView({rows,d,onOpen,dataView,dataViewLabel}:{rows:DataRow[];d:Required<ViewDisplay>;onOpen:(row:DataRow)=>void;dataView?:ReactNode;dataViewLabel?:string}){
 const {application}=useAuth(),openImage=useImagePreview(),callbacks=useRef({onOpen,openImage});callbacks.current={onOpen,openImage};
 const root=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),markers=useRef(new Map<number,Marker>()),fit=useRef<()=>void>(()=>{});
 const [error,setError]=useState(''),[page,setPage]=useState(1),[selected,setSelected]=useState<number|null>(null),[retry,setRetry]=useState(0),[ready,setReady]=useState(false);
 const points=useMemo(()=>mapPoints(rows,d),[rows,d.map_location,d.map_lat,d.map_lng,d.map_title]);
 useEffect(()=>{setPage(1);setSelected(null);},[points]);
 useEffect(()=>{
  let cancelled=false,observer:ResizeObserver|undefined,instance:LeafletMap|undefined;setError('');setReady(false);
  import('leaflet').then(L=>{
   if(cancelled||!root.current)return;const m=L.map(root.current,{scrollWheelZoom:d.map_scroll_zoom,zoomControl:false,preferCanvas:true}).setView([points[0]?.lat??13.7563,points[0]?.lng??100.5018],points.length?d.map_zoom:6);instance=m;map.current=m;markers.current.clear();
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on('tileerror',()=>{if(!cancelled)setError('โหลดพื้นแผนที่ไม่ได้ · กรุณาตรวจอินเทอร์เน็ต ยังเปิดข้อมูลจากหมุดได้');}).addTo(m);
   for(const [index,p] of points.entries()){
    const content=document.createElement('span');content.className='map-marker-shape shape-'+d.map_marker;
    const inner=document.createElement('span');inner.className='map-marker-content';inner.textContent=d.map_marker==='number'?String(index+1):'';content.append(inner);
    const size=d.map_marker_size*2,marker=L.marker([p.lat,p.lng],{title:p.label,keyboard:true,icon:L.divIcon({className:'map-marker-icon',html:content,iconSize:[size,size],iconAnchor:d.map_marker==='pin'?[size/2,size]:[size/2,size/2],popupAnchor:[0,-size/2]})});
    const popup=document.createElement('div');popup.className='map-popup modern-map-popup';
    const photo=p.row[d.map_image||''];if(typeof photo==='string'&&/^\/api\/images\/[a-f0-9-]{36}$/.test(photo)){const photoButton=document.createElement('button');photoButton.type='button';photoButton.className='map-popup-photo';photoButton.setAttribute('aria-label','ดูภาพเต็ม '+p.label);const image=document.createElement('img');image.src=appResourceUrl(photo,application);image.alt=p.label;photoButton.append(image);photoButton.addEventListener('click',()=>callbacks.current.openImage(photo,p.label));popup.append(photoButton);}
    const title=document.createElement('button');title.type='button';title.className='map-popup-title';title.textContent=p.label||String(p.row.id);title.addEventListener('click',()=>callbacks.current.onOpen(p.row));popup.append(title);
    if(d.map_show_coordinates){const coordinates=document.createElement('small');coordinates.textContent=p.lat.toFixed(5)+', '+p.lng.toFixed(5);popup.append(coordinates);}
    const detail=document.createElement('button');detail.type='button';detail.className='map-popup-detail';detail.textContent='ดูรายละเอียด';detail.addEventListener('click',()=>callbacks.current.onOpen(p.row));popup.append(detail);
    marker.bindPopup(popup).bindTooltip(Object.assign(document.createElement('span'),{textContent:p.label})).on('click',()=>setSelected(p.row.id)).addTo(m);marker.getElement()?.setAttribute('aria-label','ตำแหน่ง '+p.label);markers.current.set(p.row.id,marker);
   }
   const showAll=()=>{if(points.length)m.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lng])),{padding:[32,32],maxZoom:d.map_zoom,animate:false});else m.setView([13.7563,100.5018],6,{animate:false});};fit.current=showAll;if(d.map_fit)showAll();
   observer=new ResizeObserver(()=>{if(root.current?.offsetWidth)m.invalidateSize({pan:false});});observer.observe(root.current);setReady(true);
  }).catch(()=>{if(!cancelled)setError('เปิดแผนที่ไม่ได้ กรุณาลองใหม่');});
  return()=>{cancelled=true;observer?.disconnect();instance?.remove();if(map.current===instance)map.current=null;markers.current.clear();fit.current=()=>{};};
 },[points,d.map_zoom,d.map_fit,d.map_scroll_zoom,d.map_marker,d.map_marker_size,d.map_image,d.map_show_coordinates,application,retry]);
 useEffect(()=>{for(const [id,marker] of markers.current)marker.getElement()?.setAttribute('data-selected',String(selected===id));},[selected,ready]);
 function focusPoint(p:typeof points[number]){setSelected(p.row.id);const m=map.current;if(!m)return;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;m.setView([p.lat,p.lng],Math.max(m.getZoom(),d.map_zoom),{animate:!reduced,duration:.25});markers.current.get(p.row.id)?.openPopup();}
 return <section className={'map-view modern-map layout-'+d.map_layout+' map-style-'+d.map_style} style={{'--map-height':d.map_height+'px','--map-radius':d.map_radius+'px','--map-marker-color':d.map_marker_color||'var(--accent)','--map-marker-size':d.map_marker_size*2+'px'} as CSSProperties} aria-label="ข้อมูลแผนที่">
  {d.map_show_summary&&<div className="map-summary"><span className="map-summary-count"><Icon name="map" width="16" height="16"/>{points.length.toLocaleString()} จุด</span>{rows.length>points.length&&<span>ไม่มีพิกัดที่ใช้ได้ {rows.length-points.length} รายการ</span>}</div>}
  <div className="map-layout"><div className="map-frame"><div className="map-canvas" aria-label="แผนที่ข้อมูล" ref={root}/><div className="map-controls" role="group" aria-label="ควบคุมแผนที่"><button type="button" disabled={!ready} aria-label="ซูมเข้า" onClick={()=>map.current?.zoomIn()}>+</button><button type="button" disabled={!ready} aria-label="ซูมออก" onClick={()=>map.current?.zoomOut()}>−</button><button type="button" disabled={!ready} aria-label="แสดงทุกจุด" onClick={()=>fit.current()}><Icon name="map" width="16" height="16"/><span>ทุกจุด</span></button></div>{!points.length&&<div className="map-empty" role="status"><Icon name="map"/><strong>ยังไม่มีจุดที่แสดงได้</strong><span>ลองเปลี่ยนคำค้นหาหรือตรวจข้อมูลพิกัด</span></div>}</div>
  {d.map_layout!=='map_only'&&<aside className="map-results" aria-label="รายการตำแหน่ง"><div className="map-results-heading"><strong>{dataViewLabel||"ตำแหน่ง"}</strong>{!dataView&&<span>{points.length.toLocaleString()} รายการ</span>}</div>{dataView?<div className="map-configured-view">{dataView}</div>:<><div className="map-point-list">{points.slice((page-1)*25,page*25).map((p,index)=><div className={'map-point-card'+(selected===p.row.id?' is-selected':'')} key={p.row.id}><button type="button" className="map-point-focus" disabled={!ready} aria-label={'แสดงตำแหน่ง '+p.label} onClick={()=>focusPoint(p)}><span className="map-point-badge">{d.map_marker==='number'?(page-1)*25+index+1:<Icon name="map" width="16" height="16"/>}</span><span className="map-point-copy"><RecordLabel text={p.label} image={p.row.__image}/>{d.map_show_coordinates&&<small>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</small>}</span></button><button type="button" className="icon-button map-point-open" aria-label={'ดูรายละเอียด '+p.label} onClick={()=>callbacks.current.onOpen(p.row)}><Icon name="chevron" width="16" height="16"/></button></div>)}</div>{points.length>25&&<div className="map-results-pagination"><button type="button" disabled={page===1} aria-label="ตำแหน่งหน้าก่อนหน้า" onClick={()=>setPage(n=>n-1)}>‹</button><span>{page} / {Math.ceil(points.length/25)}</span><button type="button" disabled={page*25>=points.length} aria-label="ตำแหน่งหน้าถัดไป" onClick={()=>setPage(n=>n+1)}>›</button></div>}</>}</aside>}</div>
  {error&&<div className="map-error" role="status"><span>{error}</span><button type="button" onClick={()=>setRetry(n=>n+1)}>ลองใหม่</button></div>}
 </section>;
}
