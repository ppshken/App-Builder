"use client";
import SearchSelect from "@/app/components/SearchSelect";
import {useEffect,useState} from "react";
import {Column,UNIQUE_TYPES} from "@/lib/columns";
import EditorDialog from "./EditorDialog";
import type {DuplicateGroup} from "@/lib/unique";
export default function DuplicateInspector({table,columns,initial,onClose}:{table:string;columns:Column[];initial?:string;onClose:()=>void}){
 const available=columns.filter(c=>!c.is_virtual&&UNIQUE_TYPES.includes(c.type));
 const [column,setColumn]=useState(initial||available[0]?.name||""),[result,setResult]=useState<{groups:number;rows:number;duplicates:DuplicateGroup[]}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(!column)return;const controller=new AbortController();setBusy(true);setError("");setResult(null);fetch(`/api/tables/${table}/duplicates?column=${encodeURIComponent(column)}`,{signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setResult(j);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[table,column,refresh]);
 return <EditorDialog title="ตรวจข้อมูลซ้ำ" wide onClose={onClose} footer={<><button disabled={busy||!column} onClick={()=>setRefresh(n=>n+1)}>ตรวจใหม่</button><button className="primary" onClick={onClose}>ปิดผลตรวจ</button></>}>
  <div className="field"><label htmlFor="duplicate-column">คอลัมน์ที่ตรวจค่าซ้ำ</label><SearchSelect id="duplicate-column" value={column} onChange={e=>setColumn(e.target.value)}>{available.map(c=><option value={c.name} key={c.name}>{c.label} ({c.name})</option>)}</SearchSelect><small className="hint">ไม่นับช่องว่าง ตัวพิมพ์เล็ก–ใหญ่และช่องว่างรอบข้อความถือว่าต่างกัน</small></div>
  {!available.length&&<p>ตารางนี้ไม่มีคอลัมน์ข้อมูลที่เก็บค่าเดียวให้ตรวจ</p>}{busy&&<p role="status">กำลังตรวจข้อมูลทุกแถว…</p>}{error&&<div className="error-banner" role="alert">{error}</div>}
  {result&&<><div className={result.groups?"duplicate-summary":"success-banner"} role="status">{result.groups?`พบ ${result.groups} ค่าที่ซ้ำกัน รวม ${result.rows} แถว` :"ไม่พบข้อมูลซ้ำ สามารถเปิดห้ามซ้ำได้"}</div>{result.duplicates.map((group,i)=><article className="duplicate-group" key={i}><strong>{String(group.value)}</strong><span className="badge">{group.count} แถว</span><div className="row">{group.ids.map(id=><a className="button" href={`/t/${table}?row=${id}&edit=1`} target="_blank" rel="noreferrer" key={id}>แก้ไขแถว {id}</a>)}</div>{group.count>group.ids.length&&<small className="hint">แสดง 20 แถวแรกของค่านี้</small>}</article>)}{result.groups>result.duplicates.length&&<p className="hint">แสดง 20 ค่าที่ซ้ำมากที่สุด แก้ไขข้อมูลแล้วกดตรวจใหม่เพื่อดูรายการที่เหลือ</p>}<p className="hint">เปิดแก้ไขในแท็บใหม่ แล้วกลับมากดตรวจใหม่ ระบบไม่ลบหรือรวมข้อมูลให้เอง</p></>}
 </EditorDialog>;
}
