"use client";
import DevelopmentPublicationPanel from '../components/DevelopmentPublicationPanel';
import ReleaseRehearsalJobsPanel from '../components/ReleaseRehearsalJobsPanel';

import Link from "next/link";
import "./releases.css";
import DraftRebasePanel from "../components/DraftRebasePanel";
import ReleasePlanPanel from "../components/ReleasePlanPanel";
import {useEffect,useRef,useState} from 'react';import {useAuth} from '../components/AuthProvider';
type Release={id:string;label:string;status:string;created_at:number;workspace_mode?:'development';expires_at?:number;schema_release?:number};
async function api(url:string,body?:unknown){const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),j=await r.json();if(!r.ok)throw Error(j.error);if(body&&["activate","live","publish","archive"].includes((body as any).op))try{localStorage.setItem("nocode:workspace",String(Date.now()));}catch{}return j;}
export default function ReleasesPage(){const reviewPanel=useRef<HTMLElement>(null);const [list,setList]=useState<'draft'|'published'|'archived'>('draft'),[loaded,setLoaded]=useState(false);const {access}=useAuth(),[items,setItems]=useState<Release[]>([]),[active,setActive]=useState(''),[label,setLabel]=useState(''),[development,setDevelopment]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState<any>(null),[confirmation,setConfirmation]=useState('');async function load(){const j=await api('/api/releases');setItems(j.items);setActive(j.active||'');setLoaded(true);}useEffect(()=>{if(access.builder)load().catch(e=>setError(e.message));},[access.builder]);async function work(run:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await run();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}if(!access.builder)return <p className="error-banner">ผู้พัฒนาแอปเท่านั้นที่จัดการเวอร์ชันได้</p>;
const draft=items.find(item=>item.id===active);
 const visible=items.filter(item=>item.status===list);
 async function inspect(item:Release){
   setReview(await api('/api/releases?id='+item.id));
   setConfirmation('');
   requestAnimationFrame(()=>{reviewPanel.current?.focus({preventScroll:true});reviewPanel.current?.scrollIntoView({block:'start'});});
 }
 return <div className="readiness-page release-workspace">
   <header className="release-page-heading">
     <div><h1>เวอร์ชันแอพ</h1><p>เตรียมงานในฉบับร่าง ตรวจผล แล้วเผยแพร่เมื่อพร้อม</p></div>
     <Link className="button" href="/readiness">ตรวจความพร้อมก่อนเผยแพร่</Link>
   </header>
   {error&&<p className="error-banner" role="alert">{error}</p>}
   <section className="panel release-current" aria-label="เวอร์ชันที่กำลังใช้งาน">
     <div><small>พื้นที่ทำงานปัจจุบัน</small><strong>{loaded?(active?'ฉบับร่าง · '+(draft?.label||'กำลังใช้งาน'):'เวอร์ชันจริง'):'กำลังโหลด…'}</strong>
     {loaded&&<p>{active?'การแก้ไขใน Builder จะบันทึกลงฉบับร่างนี้':'การแก้ไขใน Builder จะบันทึกลงเวอร์ชันจริง'}</p>}</div>
     {active&&<button disabled={busy} onClick={()=>work(async()=>{await api('/api/releases',{op:'live'});location.reload();})}>กลับเวอร์ชันจริง</button>}
   </section>
   <details className="panel release-create">
     <summary>สร้างฉบับร่างใหม่</summary>
     <div className="release-create-fields">
       <label>ชื่อฉบับร่าง<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="เช่น ปรับฟอร์มตรวจสภาพ"/></label>
       <fieldset><legend>ประเภทฉบับร่าง</legend>
         <div className="release-mode-options">
         <label><input type="radio" name="release-mode" checked={!development} onChange={()=>setDevelopment(false)}/><span><strong>การตั้งค่า</strong><small>สำหรับแก้ View, สูตร, Action หรือแม่แบบ PDF</small></span></label>
         <label><input type="radio" name="release-mode" checked={development} onChange={()=>setDevelopment(true)}/><span><strong>พื้นที่พัฒนาโครงสร้าง</strong><small>สำหรับเพิ่มตารางหรือคอลัมน์ในสำเนาอายุ 14 วัน</small></span></label>
         </div>
       </fieldset>
       <button className="primary" disabled={busy||!label.trim()} onClick={()=>work(async()=>{await api('/api/releases',{op:'create',label,mode:development?'development':'configuration'});setLabel('');setList('draft');await load();})}>สร้างฉบับร่างจากเวอร์ชันจริง</button>
     </div>
   </details>
   <section className="panel release-library">
     <div className="release-list-tabs" role="group" aria-label="รายการเวอร์ชัน">
       {([['draft','ฉบับร่าง'],['published','ประวัติเผยแพร่'],['archived','เก็บแล้ว']] as const).map(([key,title])=><button key={key} type="button" aria-pressed={list===key} onClick={()=>setList(key)}>{title}</button>)}
     </div>
     {loaded&&!visible.length&&<p className="hint">{list==='draft'?'ยังไม่มีฉบับร่าง':list==='published'?'ยังไม่มีเวอร์ชันที่เผยแพร่':'ยังไม่มีฉบับร่างที่เก็บแล้ว'}</p>}
     {visible.map(item=><article className="release-list-row" key={item.id}>
       <div className="release-list-meta">
         <strong>{item.label}</strong>{active===item.id&&<span className="badge blue">กำลังใช้งาน</span>}
         <small>{item.status==='draft'?(item.workspace_mode==='development'?'พื้นที่พัฒนาโครงสร้าง · ':'ฉบับร่างการตั้งค่า · '):''}{new Date(item.created_at).toLocaleString('th-TH')}{item.workspace_mode==='development'&&item.status==='draft'&&item.expires_at?' · หมดอายุ '+new Date(item.expires_at).toLocaleDateString('th-TH'):''}</small>
       </div>
       <div className="row release-list-actions">{item.status==='draft'?<>
         {active!==item.id&&<button disabled={busy} onClick={()=>work(async()=>{await api('/api/releases',{op:'activate',id:item.id});location.href='/readiness';})}>เปิดฉบับร่าง</button>}
         <button className="primary" disabled={busy} onClick={()=>work(()=>inspect(item))}>ตรวจและเผยแพร่</button>
         <button disabled={busy} onClick={()=>work(async()=>{await api('/api/releases',{op:'archive',id:item.id});if(active===item.id){location.reload();return;}if(review?.manifest.id===item.id)setReview(null);await load();})}>เก็บฉบับร่าง</button>
       </>:item.status==='published'&&!item.schema_release?<button disabled={busy} onClick={()=>work(async()=>{await api('/api/releases',{op:'create',label:'ย้อนก่อน '+item.label,version:item.id,before:true});setList('draft');await load();})}>สร้างฉบับร่างย้อนกลับ</button>:null}</div>
     </article>)}
   </section>
   {review&&<section ref={reviewPanel} className="panel release-review" tabIndex={-1}><div className="release-page-heading"><h2>ตรวจฉบับร่าง · {review.manifest.label}</h2><button type="button" disabled={busy} onClick={()=>setReview(null)}>ปิดผลตรวจ</button></div><p>{review.changes.length} หมวดที่เปลี่ยน · ปัญหา {review.health.errors} · ข้อควรตรวจ {review.health.warnings}</p>{review.conflict&&<DraftRebasePanel key={review.manifest.id} id={review.manifest.id} onApplied={async()=>{setReview(await api("/api/releases?id="+review.manifest.id));setConfirmation("");try{localStorage.setItem("nocode:workspace",String(Date.now()));}catch{}}}/> }{review.plan&&<ReleasePlanPanel plan={review.plan} publicationAvailable={review.manifest.workspace_mode==='development'}/>}{review.manifest.workspace_mode==='development'&&<ReleaseRehearsalJobsPanel key={review.manifest.id} workspaceId={review.manifest.id} planHash={review.rehearsal_hash} legacyResult={review.rehearsal}/>}{review.manifest.workspace_mode==='development'&&<DevelopmentPublicationPanel key={'publish-'+review.manifest.id+review.rehearsal_hash} workspaceId={review.manifest.id}/>}{!!review.changes.length&&<details className="release-extra"><summary>รายละเอียดค่าที่เปลี่ยน</summary>{review.changes.map((c:any)=><details className="release-change" key={c.table}><summary>{c.table}: เปลี่ยน {c.items.length} รายการ · จำนวน {c.before} → {c.after}</summary>{c.items.map((item:any)=><section key={item.key}><strong>{item.label} · {item.operation==='create'?'เพิ่ม':item.operation==='delete'?'ลบ':'แก้ไข'}</strong>{item.fields.map((f:any)=><div className="release-field-diff" key={f.name}><code>{f.name}</code><pre>{f.before===undefined?'—':String(f.before)}</pre><span>→</span><pre>{f.after===undefined?'—':String(f.after)}</pre></div>)}</section>)}</details>)}</details>}{review.health.issues.map((x:any,i:number)=><article className="health-issue" key={i}><div><strong>{x.label}</strong><p>{x.severity==='error'?'ต้องแก้ไข':'ข้อควรตรวจ'}: {x.message}</p></div><button disabled={busy} onClick={()=>work(async()=>{await api('/api/releases',x.kind==='permission'?{op:'live'}:{op:'activate',id:review.manifest.id});location.href=x.href;})}>{x.kind==='permission'?'จัดการสิทธิ์เวอร์ชันจริง':'เปิดฉบับร่างไปแก้ไข'}</button></article>)}{review.manifest.workspace_mode!=='development'&&<><label>พิมพ์ “เผยแพร่” เพื่อยืนยัน<input aria-label="ยืนยันเผยแพร่" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button className="primary" disabled={busy||review.conflict||review.plan?.publishBlocked||review.health.errors>0||confirmation!=='เผยแพร่'} onClick={()=>work(async()=>{await api('/api/releases',{op:'publish',id:review.manifest.id,review_hash:review.review_hash,confirmation});location.reload();})}>เผยแพร่การตั้งค่า</button></>}</section>}</div>;}
