"use client";
import {useEffect,useState} from 'react';
import DesignerPreview from './DesignerPreview';
import type {RowAction} from '@/lib/automation';
import type {AppView} from '@/lib/views';
export default function ActionPreview({action,views,revision}:{action:RowAction|null;views:AppView[];revision:number}){
const [selected,setSelected]=useState('');
useEffect(()=>{const matches=views.filter(v=>v.table_name===action?.table_name&&v.position!=='inline');setSelected(current=>['primary','prominent'].includes(action?.appearance?.position||'')?(matches.find(v=>v.kind==='detail')?.name||current):matches.some(v=>v.name===current)?current:(matches.find(v=>!['form','detail'].includes(v.kind))||matches[0])?.name||'');},[action?.table_name,action?.appearance?.position,views]);
return <div className="action-preview-column"><DesignerPreview actionDraft={action} draft={null} dirty={false} views={views} selected={selected} revision={revision} onSelect={setSelected} onOpenSettings={name=>{location.href='/views?view='+encodeURIComponent(name);}}/></div>;
}
