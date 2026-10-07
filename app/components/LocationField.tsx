"use client";
import {useEffect,useRef,useState} from "react";
import LocationMap from "./LocationMap";
import {normalizeCoordinates,parseCoordinates} from "@/lib/location";
export type LocationStatus={pending:boolean;error:string};
let acquiring:Promise<string>|null=null;
function locate():Promise<string>{if(acquiring)return acquiring;acquiring=new Promise<string>((resolve,reject)=>{if(!navigator.geolocation){reject(Error("เครื่องหรือเบราว์เซอร์นี้ไม่รองรับตำแหน่ง กรุณาใช้เบราว์เซอร์ที่รองรับ"));return;}navigator.geolocation.getCurrentPosition(p=>{try{resolve(normalizeCoordinates(p.coords.latitude.toFixed(7)+","+p.coords.longitude.toFixed(7)));}catch(e){reject(e);}},e=>reject(Error(e.code===1?"ยังไม่ได้อนุญาตตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งของเว็บไซต์แล้วกดดึงอีกครั้ง":e.code===3?"หาตำแหน่งนานเกินไป กรุณาตรวจ GPS แล้วกดดึงอีกครั้ง":"หาตำแหน่งไม่ได้ กรุณาเปิดบริการตำแหน่งของเครื่องแล้วกดดึงอีกครั้ง")),{enableHighAccuracy:true,timeout:15000,maximumAge:0});}).finally(()=>{acquiring=null;});return acquiring;}
export default function LocationField({id,label,value,auto,newRow,editable,disabled,onChange,onStatus,required,invalid,describedBy,hidden=false}:{id:string;label:string;value:unknown;auto:boolean;newRow:boolean;editable:boolean;disabled:boolean;onChange:(value:string)=>void;onStatus:(status:LocationStatus)=>void;required?:boolean;invalid?:boolean;describedBy?:string;hidden?:boolean}){
 const [pending,setPending]=useState(false),[error,setError]=useState(""),started=useRef(false),mounted=useRef(false),callbacks=useRef({onChange,onStatus});callbacks.current={onChange,onStatus};const latest=useRef({auto,editable,value});latest.current={auto,editable,value};
 async function acquire(){setError("");setPending(true);callbacks.current.onStatus({pending:true,error:""});try{const result=await locate();if(mounted.current&&latest.current.editable)callbacks.current.onChange(result);}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current){setPending(false);callbacks.current.onStatus({pending:false,error:""});}}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;callbacks.current.onStatus({pending:false,error:""});};},[]);
 useEffect(()=>{if(auto&&(newRow||!parseCoordinates(value))&&editable&&!disabled&&!started.current){started.current=true;void acquire();}},[auto,newRow,editable,disabled]);
 if(hidden)return <>{pending&&<p className="hint" role="status">กำลังดึงตำแหน่งของ {label}…</p>}{error&&<p className="err" role="alert">{label}: {error} <button type="button" disabled={disabled||!editable} onClick={()=>void acquire()}>ดึงตำแหน่งอีกครั้ง</button></p>}</>;
 const locked=disabled||!editable||pending;
 return <div className="location-field"><input id={id} type="text" value={typeof value==="string"?value:""} placeholder="13.7097601,100.8135513" readOnly={auto||!editable} disabled={disabled||pending} aria-required={required} aria-invalid={invalid} aria-describedby={describedBy} onChange={e=>onChange(e.target.value)}/>
 <div className="location-controls"><button type="button" disabled={locked} onClick={()=>void acquire()}>{pending?"กำลังหาตำแหน่ง…":value?"ดึงตำแหน่งปัจจุบันใหม่":"ใช้ตำแหน่งปัจจุบัน"}</button><small className="hint">{auto?"พิกัดจากเครื่อง · ไม่สามารถพิมพ์หรือจิ้มแผนที่เพื่อเปลี่ยนเอง":"พิมพ์พิกัด จิ้มแผนที่ หรือดึงตำแหน่งจากเครื่อง"}</small></div>
 {error&&<p className="err" role="alert">{error}</p>}{pending&&<p className="hint" role="status">กำลังขอตำแหน่งจากเครื่อง กรุณาอนุญาตในเบราว์เซอร์</p>}
 <LocationMap value={value} label={"แผนที่ "+label} onChange={!auto&&!locked?onChange:undefined}/>{!!value&&!parseCoordinates(value)&&<small className="err">พิกัดไม่ถูกต้อง ใช้รูปแบบ ละติจูด,ลองจิจูด</small>}
 </div>;
}
