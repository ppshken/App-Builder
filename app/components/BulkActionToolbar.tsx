"use client";
import {useEffect,useRef,useState} from 'react';
import type {BulkSelection} from '@/lib/bulk-action-config';
import type {BulkRequest,BulkResult} from '@/lib/bulk-actions';
import {createUuid} from '@/lib/uuid';
import {useAuth} from './AuthProvider';
import ConfirmDialog from './ConfirmDialog';
import SearchSelect from './SearchSelect';
type Summary={status:string;total:number;success:number;failed:number;skipped:number;processed:number;results:BulkResult[]};
type Option={name:string;label:string;fields:string[]};
const messages:Record<string,string>={PERMISSION_DENIED:'ไม่มีสิทธิ์แก้ไข',ROW_NOT_FOUND:'ไม่พบแถวหรือไม่มีสิทธิ์ดู',VERSION_CONFLICT:'ข้อมูลเปลี่ยนแล้ว โปรดตรวจแล้วเลือกแถวใหม่',ACTION_NOT_AVAILABLE:'ไม่ผ่านเงื่อนไข Action',ACTION_CHANGED:'การตั้งค่าเปลี่ยนแล้ว',VALIDATION_ERROR:'ข้อมูลไม่ผ่านการตรวจสอบ',DATABASE_ERROR:'บันทึกไม่ได้',EXECUTION_TIMEOUT:'หมดเวลา ยังไม่ได้ดำเนินการ'};
export default function BulkActionToolbar({viewName,tableLabel,selection,onSelection,busy,onBusy,onComplete,revision}:{viewName:string;tableLabel:string;selection:BulkSelection;onSelection:(s:BulkSelection)=>void;busy:boolean;onBusy:(v:boolean)=>void;onComplete:()=>Promise<void>;revision:number}){
 const {application,workspace,user}=useAuth(),[options,setOptions]=useState<Option[]>([]),[action,setAction]=useState(''),[confirm,setConfirm]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Summary|null>(null),[progress,setProgress]=useState(0),[dataEpoch,setDataEpoch]=useState('');
 const request=useRef<BulkRequest|null>(null),running=useRef(false),mounted=useRef(true);
 const [discardPending,setDiscardPending]=useState(false);
 const selectedIds=Object.keys(selection).join(',');
 const storageKey=`nocode:bulk:${application}:${workspace}:${user?.id}:${viewName}`;
 useEffect(()=>{mounted.current=true;try{const old=sessionStorage.getItem(storageKey);if(old){const r=JSON.parse(old);if(r.viewName!==viewName||typeof r.dataEpoch!=='string'||!r.versions||typeof r.versions!=='object'||!Array.isArray(r.rowIds)||r.rowIds.length<1||r.rowIds.length>100||r.rowIds.some((id:unknown)=>!Number.isSafeInteger(id)||Number(id)<1)||typeof r.idempotencyKey!=='string')throw Error('Invalid saved operation');request.current=r;onSelection(r.versions);setError('มีรายการที่ยังไม่ทราบผล กดตรวจผล/ลองต่อเพื่อใช้คำขอเดิม');}}catch{}return()=>{mounted.current=false;};},[storageKey]);
 useEffect(()=>{const c=new AbortController();fetch('/api/actions/bulk-execute?view='+encodeURIComponent(viewName)+'&ids='+encodeURIComponent(selectedIds),{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const metadata=await r.json(),next=metadata.actions;setDataEpoch(metadata.dataEpoch);setOptions(next);setAction(old=>next.some((o:Option)=>o.name===old)?old:next[0]?.name||'');}).catch(()=>{if(!c.signal.aborted)setOptions([]);});return()=>c.abort();},[viewName,revision,selectedIds]);
 async function execute(){if(running.current)return;running.current=true;onBusy(true);setConfirm(false);setError('');setProgress(0);
  const payload=request.current||{actionId:action,viewName,dataEpoch,rowIds:Object.keys(selection).map(Number),versions:{...selection},idempotencyKey:createUuid()};request.current=payload;
  try{sessionStorage.setItem(storageKey,JSON.stringify(payload));}catch{}
  let polling=false;const timer=setInterval(async()=>{if(polling)return;polling=true;try{const r=await fetch('/api/actions/bulk-execute?idempotencyKey='+encodeURIComponent(payload.idempotencyKey));if(r.ok){const s=await r.json();if(mounted.current)setProgress(s.processed);}}catch{}finally{polling=false;}},650);
  try{const r=await fetch('/api/actions/bulk-execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await r.json();if(!r.ok){if(j.code==='DATA_EPOCH_CHANGED'){request.current=null;try{sessionStorage.removeItem(storageKey);}catch{}onSelection({});}throw Error(j.error||'ทำรายการไม่ได้');}if(j.status!=='completed')throw Error('รายการกำลังทำงาน กดตรวจผล/ลองต่ออีกครั้ง');
   try{sessionStorage.removeItem(storageKey);}catch{}request.current=null;if(!mounted.current)return;
   setResult(j);setProgress(j.processed);onSelection(Object.fromEntries(j.results.filter((r:BulkResult)=>r.status==='failed').map((r:BulkResult)=>[r.rowId,payload.versions[r.rowId]])));
   await onComplete();
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'เครือข่ายขัดข้อง กรุณาลองต่อด้วยคำขอเดิม');}
  finally{clearInterval(timer);running.current=false;if(mounted.current)onBusy(false);}
 }
 const count=Object.keys(selection).length,chosen=options.find(o=>o.name===action);
 function clearSelection(){try{sessionStorage.removeItem(storageKey);}catch{}request.current=null;onSelection({});setResult(null);setError('');setDiscardPending(false);}
 return <section className="bulk-actions-panel" aria-label="จัดการหลายแถว">
  {(count>0||!!request.current)&&<div className="bulk-actions-toolbar" role="toolbar" aria-label="Bulk Actions"><strong>เลือก {request.current?.rowIds.length||count} รายการ</strong><SearchSelect aria-label="Action หลายแถว" value={action} disabled={busy||!!request.current} onChange={e=>setAction(e.target.value)}><option value="">เลือก Action แก้ไขแถว</option>{options.map(o=><option value={o.name} key={o.name}>{o.label}</option>)}</SearchSelect><button className="primary" disabled={busy||!dataEpoch||!action&&!request.current} onClick={()=>request.current?void execute():setConfirm(true)}>{busy?<><span className="app-loading-spinner"/> {progress}/{request.current?.rowIds.length||count}</>:request.current?'ตรวจผล / ลองต่อ':'ดำเนินการ'}</button><button disabled={busy} onClick={()=>request.current?setDiscardPending(true):clearSelection()}>{request.current?'หยุดติดตามรายการนี้':'ล้างที่เลือก'}</button></div>}
  {count>0&&!options.length&&!request.current&&<p className="hint">ไม่มี Action ที่ใช้ Bulk ได้ ตรวจสิทธิ์ การตั้งค่า View และ Automation ที่ทำงานเมื่ออัปเดต</p>}
  {error&&<p className="err" role="alert">{error} {request.current&&'ใช้คำขอเดิมเพื่อป้องกันทำซ้ำ'}</p>}
  {result&&<div role="status" className="bulk-actions-summary">สำเร็จ {result.success} · ล้มเหลว {result.failed} · ข้าม {result.skipped}{result.results.some(r=>r.code)&&<details><summary>รายละเอียดผลรายแถว</summary><ul>{result.results.filter(r=>r.code).map(r=><li key={r.rowId}>ID {r.rowId}: {messages[r.code!]||'ทำรายการไม่ได้'}</li>)}</ul></details>}</div>}
  {confirm&&<ConfirmDialog titleId="bulk-confirm-title" busy={busy} onCancel={()=>setConfirm(false)}><h2 id="bulk-confirm-title">ยืนยัน {chosen?.label}</h2><p>ตาราง {tableLabel} · {count} แถวที่เลือกไว้อย่างชัดเจน</p><p>คอลัมน์ที่ Action กำหนด: {chosen?.fields.join(', ')}</p><p className="hint">ระบบตรวจเงื่อนไขและสิทธิ์ใหม่ทุกแถว บางแถวอาจสำเร็จและบางแถวไม่สำเร็จ โปรดตรวจสอบก่อนเปลี่ยนข้อมูลจำนวนมาก</p><div className="row"><button disabled={busy} onClick={()=>setConfirm(false)}>ยกเลิก</button><button className="primary" disabled={busy} onClick={()=>void execute()}>ยืนยันดำเนินการ</button></div></ConfirmDialog>}
  {discardPending&&<ConfirmDialog titleId="bulk-discard-title" busy={busy} onCancel={()=>setDiscardPending(false)}><h2 id="bulk-discard-title">หยุดติดตามรายการนี้?</h2><p>งานที่ส่งไปอาจบันทึกแล้วหรือกำลังทำอยู่ การหยุดติดตามไม่ยกเลิกงานบนเซิร์ฟเวอร์ กรุณาตรวจข้อมูลล่าสุดก่อนเลือกทำรายการใหม่ หากต้องการทราบผลเดิม ให้กลับไปกดตรวจผล / ลองต่อ</p><div className="row"><button onClick={()=>setDiscardPending(false)}>กลับไปตรวจผล</button><button onClick={clearSelection}>ยืนยันหยุดติดตาม</button></div></ConfirmDialog>}
 </section>;
}
