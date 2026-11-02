"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '../components/AuthProvider';
import SimulationTester from '../components/SimulationTester';
import SearchSelect from '../components/SearchSelect';
type Issue={kind:string;name:string;label:string;severity:'error'|'warning';message:string;href:string};
type Report={checked:number;errors:number;warnings:number;issues:Issue[];skipped?:string[];checked_at:string;sampled:boolean};
const kinds:Record<string,string>={table:'ตาราง',formula:'สูตร',sample:'ข้อมูลตัวอย่าง',view:'View',slice:'Slice',action:'Action',automation:'Automation',pdf:'แม่แบบ PDF',jobs:'ประวัติงาน',permission:'สิทธิ์',settings:'การตั้งค่า',navigation:'เมนู'};
export default function ReadinessPage(){
 const {access}=useAuth(),[busy,setBusy]=useState(false),[sample,setSample]=useState(false),[error,setError]=useState('');
 const [report,setReport]=useState<Report|null>(null),[filter,setFilter]=useState('all');
 const [items,setItems]=useState<{kind:'action'|'automation';name:string;label:string}[]>([]),[selected,setSelected]=useState('');
 useEffect(()=>{const controller=new AbortController();const load=async(url:string)=>{const r=await fetch(url,{signal:controller.signal}),j=await r.json();if(!r.ok)throw Error(j.error);return j;};Promise.all([load('/api/actions'),access.builder?load('/api/workflows'):[]]).then(([a,w])=>setItems([...a.map((x:any)=>({...x,kind:'action'})),...w.map((x:any)=>({...x,kind:'automation'}))])).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[access.builder]);
 async function inspect(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/readiness?sample='+(sample?'1':'0'),{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);setReport(j);setFilter('all');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const item=items.find(x=>x.kind+':'+x.name===selected),issues=report?.issues.filter(x=>filter==='all'||x.severity===filter)||[];
 return <div className="readiness-page">
  <div className="page-heading"><div><h1>ตรวจความพร้อมก่อนเผยแพร่</h1><p>รวมจุดที่ต้องแก้ไข พร้อมเปิดไปยังหน้าตั้งค่าที่เกี่ยวข้อง</p></div><Link className="button" href="/releases">ฉบับร่างและเวอร์ชัน</Link></div>
  {error&&<p className="error-banner" role="alert">{error}</p>}
  <section className="panel"><h2>ตรวจสุขภาพแอพ</h2><p className="hint">ตรวจสูตร ตารางอ้างอิง View Slice เมนู สิทธิ์ของบทบาท Action Automation และแม่แบบ PDF</p><p className="hint">อ่านการตั้งค่าเท่านั้น การตรวจข้อมูลตัวอย่างอ่านสูงสุด 10 แถวต่อตาราง ผลตรวจไม่ครอบคลุมทุกข้อมูลหรือเงื่อนไขของผู้ใช้ทุกคน</p>
   <label className="checkbox-label"><input type="checkbox" disabled={busy} checked={sample} onChange={e=>setSample(e.target.checked)}/>ตรวจสูตรกับข้อมูลตัวอย่างด้วย</label>
   <button className="primary" disabled={busy} aria-busy={busy} onClick={inspect}>{busy?'กำลังตรวจ…':'ตรวจสุขภาพแอพ'}</button>
   {report&&<div className="readiness-results" aria-live="polite" aria-busy={busy}>
    <div className={report.errors?'error-banner':report.warnings||report.skipped?.length?'readiness-review-banner':'success-banner'} role="status"><strong>{report.errors?'ต้องแก้ไขก่อนเผยแพร่':report.warnings?'มีข้อควรตรวจสอบก่อนเผยแพร่':report.skipped?.length?'ตรวจแล้วบางส่วน':'พร้อมเผยแพร่ตามรายการที่ตรวจ'}</strong><p>{report.errors?'แก้ข้อผิดพลาดแล้วตรวจใหม่ก่อนเผยแพร่ฉบับร่าง':report.warnings?'ตรวจข้อควรระวังและทดสอบขั้นตอนใช้งานจริงก่อนเผยแพร่':report.skipped?.length?'ยังมีรายการที่ต้องตรวจด้วยบัญชีที่มีสิทธิ์':'ไม่พบปัญหาจากรายการที่ตรวจ'}</p></div>
    <p>ตรวจ {report.checked} รายการ · ปัญหา {report.errors} · ข้อควรตรวจ {report.warnings}</p>
    <p className="hint">ตรวจเมื่อ {new Date(report.checked_at).toLocaleString('th-TH')} · {report.sampled?'ตรวจข้อมูลตัวอย่างแล้ว':'ยังไม่ได้ตรวจข้อมูลตัวอย่าง'} · หากแก้การตั้งค่าแล้ว กรุณาตรวจใหม่</p>
    {!!report.skipped?.length&&<p className="hint">รายการที่ยังไม่ได้ตรวจ: {report.skipped.join(', ')}</p>}
    {!!report.issues.length&&<><div className="readiness-filters" role="group" aria-label="กรองผลตรวจ">{[['all','ทั้งหมด',report.issues.length],['error','ต้องแก้ไข',report.errors],['warning','ข้อควรตรวจ',report.warnings]].map(([key,label,count])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(String(key))}>{label} ({count})</button>)}</div>
     {issues.length?issues.map((issue,i)=><article className="health-issue" key={issue.kind+issue.name+i} data-severity={issue.severity}><div><span className={'readiness-severity '+issue.severity}>{issue.severity==='error'?'ต้องแก้ไข':'ข้อควรตรวจ'}</span><strong>{issue.label}</strong><small>{kinds[issue.kind]||issue.kind} · {issue.name}</small><p>{issue.message}</p></div><Link className="button" href={issue.href}>ไปแก้ไข</Link></article>):<p className="hint">ไม่มีรายการในหมวดนี้</p>}</>}
    <Link className="button" href="/releases">ไปตรวจฉบับร่างและเผยแพร่</Link>
   </div>}
  </section>
  <section className="panel"><h2>จำลอง Action และ Automation</h2><label>รายการที่จะทดสอบ<SearchSelect aria-label="รายการที่จะทดสอบ" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">เลือกรายการ</option>{items.map(x=><option key={x.kind+':'+x.name} value={x.kind+':'+x.name}>{x.kind==='action'?'Action':'Automation'} · {x.label}</option>)}</SearchSelect></label>{item&&<SimulationTester key={selected} kind={item.kind} name={item.name}/>}</section>
 </div>;
}
