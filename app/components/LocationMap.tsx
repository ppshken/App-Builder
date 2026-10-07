"use client";
import {useEffect,useRef,useState} from "react";
import type {Map as LeafletMap,CircleMarker} from "leaflet";
import {parseCoordinates} from "@/lib/location";
export default function LocationMap({value,onChange,label="แผนที่พิกัด"}:{value:unknown;onChange?:(value:string)=>void;label?:string}) {
 const root=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<CircleMarker|null>(null),[ready,setReady]=useState(0),[error,setError]=useState("");
 const change=useRef(onChange);change.current=onChange;const current=useRef(value);current.current=value;
 useEffect(()=>{let cancelled=false,observer:ResizeObserver|undefined;import("leaflet").then(L=>{if(cancelled||!root.current)return;const p=parseCoordinates(current.current),m=L.map(root.current,{scrollWheelZoom:false}).setView(p?[p.lat,p.lng]:[13.7563,100.5018],p?15:6);map.current=m;
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on("tileerror",()=>setError("โหลดพื้นแผนที่ไม่ได้ กรุณาตรวจอินเทอร์เน็ต พิกัดยังบันทึกได้")).addTo(m);
 marker.current=L.circleMarker(p?[p.lat,p.lng]:[0,0],{radius:8,color:"#2563eb",fillColor:"#2563eb",fillOpacity:0.85});if(p)marker.current.addTo(m);
 m.on("click",e=>change.current?.(e.latlng.lat.toFixed(7)+","+e.latlng.lng.toFixed(7)));observer=new ResizeObserver(()=>{if(root.current?.offsetWidth)m.invalidateSize();});observer.observe(root.current);setReady(n=>n+1);
 }).catch(()=>setError("เปิดแผนที่ไม่ได้ กรุณาโหลดหน้าใหม่"));return()=>{cancelled=true;observer?.disconnect();map.current?.remove();map.current=null;marker.current=null;};},[]);
 const p=parseCoordinates(value),lat=p?.lat,lng=p?.lng;
 useEffect(()=>{const m=map.current,point=marker.current;if(!m||!point)return;if(lat===undefined||lng===undefined){point.remove();return;}point.setLatLng([lat,lng]).addTo(m);m.setView([lat,lng],Math.max(m.getZoom(),15),{animate:false});},[lat,lng,ready]);
 return <div className="location-map"><div ref={root} className="location-map-canvas" aria-label={label}/>{error&&<small className="hint" role="status">{error}</small>}</div>;
}
