'use client';
import {useEffect,useState} from 'react';
import ApplicationRolesEditor from '../apps/ApplicationRolesEditor';
import UserSettingsEditor from '../components/UserSettingsEditor';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '../components/AuthProvider';
import ApplicationAccessEditor from '../apps/ApplicationAccessEditor';
import type {Application} from '@/lib/applications';
export default function ApplicationAccessPage(){
 const params=useSearchParams(),[membersOpen,setMembersOpen]=useState(params.get('tab')==='members');const {application,access}=useAuth(),[app,setApp]=useState<Application>(),[error,setError]=useState(''),[open,setOpen]=useState(false);
 useEffect(()=>{const abort=new AbortController();fetch('/api/applications',{signal:abort.signal}).then(async r=>{const items=await r.json();if(!r.ok)throw Error(items.error);const selected=items.find((a:Application)=>a.id===application);if(!selected)throw Error('ไม่พบแอปที่เลือก');setApp(selected);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[application]);
 return <section><div className="page-heading"><div><h1>ตารางและสิทธิ์</h1><p>จัดการตารางที่เชื่อมต่อและสิทธิ์ของแอป {app?.label}</p></div>{access.owner&&<button className="primary" disabled={!app} onClick={()=>setOpen(true)}>จัดการตารางและสิทธิ์</button>}</div>{error&&<p className="err" role="alert">{error}</p>}{access.owner&&<details className="panel application-user-settings" open={membersOpen} onToggle={e=>setMembersOpen(e.currentTarget.open)}><summary>ผู้ใช้และบทบาทของแอปนี้</summary>{membersOpen&&app&&<ApplicationRolesEditor key={app.id} app={app}/>}</details>}<details open={params.get("tab")==="user-settings"} className="panel application-user-settings"><summary>ค่าตั้งค่าผู้ใช้ของแอปนี้</summary><UserSettingsEditor manage/></details>{!access.owner&&<p className="hint">การเชื่อมตารางจากแอปอื่นและการจัดการสมาชิก ให้เจ้าของ Builder จัดการจากข้อมูลส่วนกลาง</p>}<p className="hint">ตารางที่สร้างในแอปนี้เป็นของแอปนี้โดยตรง สามารถเชื่อมตารางจากแอปอื่นและกำหนดสิทธิ์แยกกันได้</p>{open&&app&&<ApplicationAccessEditor app={app} onClose={()=>setOpen(false)} onCreateTable={()=>location.assign('/data?new=1')}/>}</section>;
}
