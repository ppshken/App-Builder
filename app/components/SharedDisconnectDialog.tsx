"use client";
import {useEffect,useState} from 'react';
import EditorDialog from './EditorDialog';
import {sharedRequest} from './shared-table-client';
import {metadataChanged} from './AppShell';
export default function SharedDisconnectDialog({tables,onClose,onDisconnected}:{tables:string[];onClose:()=>void;onDisconnected:()=>void}){
 const [impact,setImpact]=useState<any>(),[busy,setBusy]=useState(false),[error,setError]=useState('');const selection=JSON.stringify(tables);
 async function check(){setBusy(true);setError('');setImpact(undefined);try{setImpact(await sharedRequest({op:'disconnect_preview',tables:JSON.parse(selection)}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void check();},[selection]);
 async function confirm(){if(busy||!impact?.allowed)return;setBusy(true);setError('');try{await sharedRequest({op:'disconnect',tables:impact.tables,token:impact.token,confirmation:'ยกเลิกเชื่อมต่อ'});metadataChanged();onDisconnected();}catch(e){setError((e as Error).message);setImpact(undefined);}finally{setBusy(false);}}
 return <EditorDialog className="shared-disconnect-dialog" title="ยืนยันยกเลิกเชื่อมต่อตารางกลาง" subtitle={`${tables.length} ตาราง · นำออกจากแอปนี้เท่านั้น`} busy={busy} onClose={onClose} wide footer={<><button disabled={busy} onClick={onClose}>กลับ</button><button disabled={busy} onClick={check}>ตรวจผลกระทบใหม่</button><button className="danger" disabled={busy||!impact?.allowed} onClick={confirm}>ยืนยันยกเลิกเชื่อมต่อ</button></>}>
  <p><strong>ข้อมูล แถว และคอลัมน์จริงของต้นทางจะไม่ถูกลบ</strong> แอปอื่นยังใช้งานตารางได้ตามเดิม</p>
  <p className="hint">การตั้งค่าด้านล่าง รวมถึงชื่อที่แสดงและ Label เฉพาะแอปนี้ จะถูกนำออกหลังยืนยัน ระบบสำรองข้อมูลก่อนทำรายการ ประวัติงานและสิทธิ์แชร์จากต้นทางยังคงอยู่</p>
  {busy&&!impact&&<p role="status">กำลังตรวจผลกระทบ…</p>}{error&&<p className="error-banner" role="alert">{error}</p>}
  {impact&&<><p>{impact.tables.join(' · ')}</p><p className="hint">การตั้งค่าที่จะนำออก {impact.removed.reduce((n:number,g:any)=>n+g.items.length,0)} รายการ · คอลัมน์คำนวณ {impact.virtuals.length} ช่อง</p><div className="shared-disconnect-impact">{impact.removed.filter((group:any)=>group.items.length>0).map((group:any)=><section key={group.kind}><h3>{group.kind} · {group.items.length}</h3>{group.items.length>0&&<ul>{group.items.map((item:any)=><li key={item.name}>{item.label}</li>)}</ul>}</section>)}<section hidden={!impact.virtuals.length}><h3>คอลัมน์คำนวณเฉพาะแอป · {impact.virtuals.length}</h3>{impact.virtuals.length>0&&<ul>{impact.virtuals.map((v:any)=><li key={v.table+':'+v.name}>{v.table} · {v.label}</li>)}</ul>}</section></div>
   {!impact.allowed?<div className="error-banner" role="alert"><strong>ยังยกเลิกไม่ได้ กรุณาแก้การอ้างอิงต่อไปนี้ก่อน</strong><ul>{impact.blockers.map((b:any,i:number)=><li key={i}>{b.label} — {b.message}{b.href&&<> <a href={b.href}>เปิดการตั้งค่า</a></>}</li>)}</ul></div>:<p className="hint">ไม่พบการอ้างอิงที่ขัดขวาง สามารถยืนยันเพื่อนำการตั้งค่าและการเชื่อมออกจากแอปนี้ได้ สิทธิ์เฉพาะตาราง/Action ที่นำออกจะถูกล้างด้วย</p>}
  </>}
 </EditorDialog>;
}
