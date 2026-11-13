"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from './AuthProvider';
import './draft-banner.css';
export default function DraftBanner(){
 const {access}=useAuth(),[label,setLabel]=useState(''),[development,setDevelopment]=useState(false);
 useEffect(()=>{if(!access.builder)return;fetch('/api/releases').then(r=>r.ok?r.json():null).then(j=>{if(j?.active){const active=j.items.find((x:any)=>x.id===j.active);setLabel(active?.label||'ฉบับร่าง');setDevelopment(active?.workspace_mode==='development');}}).catch(()=>{});},[access.builder]);
 if(!label)return null;
 return <aside className="draft-banner draft-banner-compact" role="status"><details><summary title={label}><span>{development?'พื้นที่พัฒนา':'ฉบับร่าง'}</span><span className="draft-banner-label">{label}</span></summary><div className="draft-banner-popover"><strong>{development?'พื้นที่พัฒนาโครงสร้าง':'ฉบับร่าง'}: {label}</strong><p>ข้อมูลทดลอง · ยังไม่เผยแพร่</p><Link href="/releases">จัดการเวอร์ชัน</Link><button onClick={async()=>{const r=await fetch('/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'live'})});if(r.ok){try{localStorage.setItem('nocode:workspace',String(Date.now()));}catch{}if(development)location.assign('/data');else location.reload();}}}>กลับเวอร์ชันจริง</button></div></details></aside>;
}
