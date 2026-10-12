"use client";
import {useEffect,useState} from 'react';
import DesignerPreview from './DesignerPreview';
import ActionButton from './ActionButton';
import type {RowAction} from '@/lib/automation';
import type {AppView} from '@/lib/views';
export default function ActionPreview({action,views,revision}:{action:RowAction|null;views:AppView[];revision:number}){
const [selected,setSelected]=useState(''),[clicked,setClicked]=useState(false);
useEffect(()=>{setClicked(false);},[action?.name]);
useEffect(()=>{const matches=views.filter(v=>v.table_name===action?.table_name&&v.position!=='inline');setSelected(current=>matches.some(v=>v.name===current)?current:(matches.find(v=>!['form','detail'].includes(v.kind))||matches[0])?.name||'');},[action?.table_name,views]);
return <div className="action-preview-column"><section className="action-live-preview" aria-label="ตัวอย่างปุ่ม Action"><strong>ตัวอย่างปุ่ม · ก่อนบันทึก</strong>{action?<><ActionButton action={{...action,label:action.label||'ชื่อปุ่ม'}} onClick={()=>setClicked(true)}/><small className="hint">ชื่อ ไอคอน สี และขนาดเปลี่ยนทันทีตามการตั้งค่า</small>{clicked&&<small role="status">ตัวอย่างหน้าตาปุ่ม ยังไม่ได้สั่งทำงานกับข้อมูล</small>}</>:<small>เลือก Action เพื่อดูตัวอย่าง</small>}</section><DesignerPreview draft={null} dirty={false} views={views} selected={selected} revision={revision} onSelect={setSelected} onOpenSettings={name=>{location.href='/views?view='+encodeURIComponent(name);}}/></div>;
}
