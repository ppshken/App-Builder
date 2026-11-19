"use client";
import {useState} from 'react';

type Choice = 'live' | 'draft';
type Preview = {token:string; imported:{collection:string;label:string;field:string}[]; conflicts:{id:string; collection:string; label:string; field:string; live?:unknown; draft?:unknown}[]};
const format = (value:unknown) => value===undefined?'ลบรายการ':typeof value==='string'?value:JSON.stringify(value,null,2);

export default function DraftRebasePanel({id,onApplied}:{id:string;onApplied:()=>Promise<void>}) {
  const [preview,setPreview]=useState<Preview|null>(null);
  const [choices,setChoices]=useState<Record<string,Choice>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function run(apply:boolean) {
    setBusy(true);
    setError('');
    try {
      const response=await fetch('/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        op:apply?'apply_rebase':'preview_rebase',id,...(apply?{token:preview?.token,choices}:{})
      })});
      const result=await response.json();
      if(!response.ok)throw Error(result.error);
      if(apply){await onApplied();return;}
      setChoices({});
      setPreview(result);
    } catch(e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {setBusy(false);}
  }
  return <section aria-label="อัปเดตฐานตั้งต้น">
    <p>เวอร์ชันจริงมีการแก้ไขหลังสร้างร่าง ตรวจผลรวมเพื่ออัปเดตฐานตั้งต้นและเก็บงานในร่างนี้</p>
    <button type="button" disabled={busy} onClick={()=>void run(false)}>ตรวจการอัปเดตฐานตั้งต้น</button>
    {error&&<p role="alert" className="error-banner">{error}</p>}
    {preview&&<>
      <p>{preview.conflicts.length? 'เลือกค่าที่จะเก็บในฉบับร่างสำหรับแต่ละรายการที่ขัดกัน':'การแก้ไขรวมกันได้โดยไม่มีข้อขัดแย้ง'}</p>
      {!!preview.imported.length&&<details><summary>การตั้งค่าจากเวอร์ชันจริงที่จะนำเข้าร่าง · {preview.imported.length} จุด</summary><ul>{preview.imported.map((item,index)=><li key={index}>{item.label} · {item.collection} · {item.field||"ทั้งรายการ"}</li>)}</ul></details>}
      {preview.conflicts.map(conflict=><fieldset key={conflict.id} disabled={busy}>
        <legend>{conflict.label} · {conflict.collection} · {conflict.field||'ทั้งรายการ'}</legend>
        <div className="release-field-diff"><pre>{format(conflict.live)}</pre><span>→</span><pre>{format(conflict.draft)}</pre></div>
        <label><input type="radio" name={conflict.id} checked={choices[conflict.id]==='live'} onChange={()=>setChoices({...choices,[conflict.id]:'live'})}/>ใช้ค่าจากเวอร์ชันจริง</label>
        <label><input type="radio" name={conflict.id} checked={choices[conflict.id]==='draft'} onChange={()=>setChoices({...choices,[conflict.id]:'draft'})}/>เก็บค่าจากฉบับร่าง</label>
      </fieldset>)}
      <button type="button" className="primary" disabled={busy||preview.conflicts.some(c=>!choices[c.id])} onClick={()=>void run(true)}>อัปเดตฐานตั้งต้นและเก็บฉบับร่าง</button>
    </>}
  </section>;
}
