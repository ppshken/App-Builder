"use client";
import {useEffect,useState} from 'react';
import Icon from './Icon';
import './raw-ref-lookup.css';
type Option={id:number;__label:string};
type Options={rows:Option[];selected:Option[];nextCursor:number|null};
type Resolved={id:string;state:'loading'|'found'|'missing'|'error';label?:string;error?:string};
export default function RawRefLookup({table,tableLabel,columnLabel,appId,value,disabled,onChoose}:{table:string;tableLabel?:string;columnLabel:string;appId:string;value:string|null;disabled:boolean;onChoose:(value:string)=>void}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[cursors,setCursors]=useState([0]),[page,setPage]=useState(0),[rows,setRows]=useState<Option[]>([]),[next,setNext]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[resolved,setResolved]=useState<Resolved>(),[revision,setRevision]=useState(0);
 const cursor=cursors[page]||0,pending=search.trim()!==query,numeric=value===null||!value.trim()?NaN:Number(value),selectedId=Number.isSafeInteger(numeric)&&numeric>0?String(numeric):'';
 const endpoint='/api/ref-options/'+encodeURIComponent(table);
 useEffect(()=>{if(search.trim()===query)return;const timer=setTimeout(()=>{setQuery(search.trim());setCursors([0]);setPage(0);},250);return()=>clearTimeout(timer);},[search,query]);
 useEffect(()=>{if(disabled)return;const controller=new AbortController();setLoading(true);setError('');setRows([]);setNext(null);
  fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-nocode-app':appId},body:JSON.stringify({query,cursor,pageSize:10,searchIds:true,includeImages:false}),signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'โหลดตารางอ้างอิงไม่สำเร็จ');if(!controller.signal.aborted){setRows((data as Options).rows);setNext(data.nextCursor);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[endpoint,appId,query,cursor,disabled,revision]);
 useEffect(()=>{if(disabled||!selectedId){setResolved(undefined);return;}const controller=new AbortController();setResolved({id:selectedId,state:'loading'});
  const timer=setTimeout(()=>{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-nocode-app':appId},body:JSON.stringify({selectedOnly:true,selectedIds:[selectedId],pageSize:10,includeImages:false}),signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'ตรวจ ID ไม่สำเร็จ');if(!controller.signal.aborted){const row=(data as Options).selected.find(r=>String(r.id)===selectedId);setResolved({id:selectedId,state:row?'found':'missing',label:row?.__label});}}).catch(e=>{if(!controller.signal.aborted)setResolved({id:selectedId,state:'error',error:e.message});});},200);return()=>{clearTimeout(timer);controller.abort();};
 },[endpoint,appId,selectedId,disabled,revision]);
 const currentLabel=value===null?'NULL · ไม่กำหนดข้อมูล':!value.trim()?'ยังไม่ได้เลือกค่าใหม่':!selectedId?'กรุณากรอก ID ที่เป็นจำนวนเต็มบวก':resolved?.id!==selectedId||resolved.state==='loading'?'กำลังตรวจชื่อของ ID '+selectedId+'…':resolved.state==='found'?resolved.label:resolved.state==='error'?resolved.error:'ไม่พบ ID นี้ หรือไม่มีสิทธิ์อ่านรายการนี้';
 function choose(row:Option){if(!disabled&&!loading&&!pending)onChoose(String(row.id));}
 return <section className="raw-ref-lookup" aria-label={'ข้อมูลอ้างอิง · '+columnLabel}>
  <header><strong>อ้างอิง: {tableLabel||table}</strong><code>{table}</code></header>
  <div className="raw-ref-current" role="status"><span>ค่าใหม่{selectedId?' · ID '+selectedId:''}:</span><strong>{currentLabel}</strong></div>
  <label className="raw-ref-search"><Icon name="search"/><input type="search" aria-label={'ค้นหา ID หรือชื่อ · '+columnLabel} placeholder="ค้นหาจาก ID หรือชื่อ…" maxLength={200} value={search} disabled={disabled} onChange={e=>setSearch(e.target.value)}/></label>
  {error?<div role="alert" className="raw-ref-error"><p>{error}</p><button type="button" disabled={disabled} onClick={()=>setRevision(n=>n+1)}>ลองโหลดอีกครั้ง</button></div>:<><div className="raw-ref-table-scroll" aria-busy={loading||pending}><table><thead><tr><th>ID</th><th>ชื่อที่แสดง</th><th>เลือก</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} aria-selected={String(row.id)===selectedId} onClick={()=>choose(row)}><td><code>{row.id}</code></td><td title={row.__label}>{row.__label}</td><td><button type="button" aria-label={'ใช้ ID '+row.id} disabled={disabled||loading||pending} onClick={e=>{e.stopPropagation();choose(row);}}>ใช้ ID นี้</button></td></tr>)}</tbody></table>{loading||pending?<p role="status">กำลังโหลดข้อมูลอ้างอิง…</p>:!rows.length&&<p>ไม่พบรายการในช่วงนี้{next!==null?' · ยังมีข้อมูลเพิ่มเติม กดถัดไปเพื่อค้นต่อ':''}</p>}</div>
   <footer><small>หน้า {page+1} · {rows.length} รายการ · ครั้งละ 10</small><div><button type="button" disabled={disabled||loading||pending||page===0} onClick={()=>setPage(n=>n-1)}>ก่อนหน้า</button><button type="button" disabled={disabled||loading||pending||next===null} onClick={()=>{if(next===null)return;setCursors(old=>[...old.slice(0,page+1),next]);setPage(n=>n+1);}}>ถัดไป</button></div></footer></>}
  <small className="raw-ref-hint">เลือกเพื่อเติม ID เท่านั้น ยังไม่บันทึก · เงื่อนไขข้อมูลจะตรวจแยกแต่ละแถวเมื่อกดบันทึก</small>
 </section>;
}
