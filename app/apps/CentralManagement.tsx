'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '../components/AuthProvider';
import Icon,{type IconName} from '../components/Icon';
import DraftBanner from '../components/DraftBanner';
import SearchSelect from '../components/SearchSelect';
const AppOperationsManager=dynamic(()=>import('./AppOperationsManager'));
const ApplicationRolesEditor=dynamic(()=>import('./ApplicationRolesEditor'));

import ApplicationAccessEditor from './ApplicationAccessEditor';
import type {Application} from '@/lib/applications';
const UsersManager=dynamic(()=>import('../users/UsersManager'),{loading:()=> <p role="status">กำลังโหลดผู้ใช้…</p>});
const BackupManager=dynamic(()=>import('../backups/BackupManager'),{loading:()=> <p role="status">กำลังโหลดข้อมูลสำรอง…</p>});
const AuditLogManager=dynamic(()=>import('../audit-log/AuditLogManager'),{loading:()=> <p role="status">กำลังโหลดประวัติ…</p>});
const SECTIONS:{id:string;label:string;icon:IconName}[]=[{id:'overview',label:'ภาพรวม',icon:'grid'},{id:'users',label:'บัญชีผู้ใช้และ Builder',icon:'users'},{id:'members',label:'ผู้ใช้รายแอป',icon:'users'},{id:'datasets',label:'ตารางข้อมูลทั้งหมด',icon:'database'},{id:'access',label:'แอปและการเชื่อมต่อ',icon:'settings'},{id:'audit',label:'ประวัติการแก้ไข',icon:'clock'},{id:'backups',label:'สำรองทั้งระบบ',icon:'folder'},{id:'app-backups',label:'สำรองแยกแอป',icon:'database-backup'},{id:'files',label:'ไฟล์และรูปภาพ',icon:'image'},{id:'usage',label:'ประวัติใช้งานแอป',icon:'clock'}];
type Overview={apps:Application[];tables:{name:string;label:string;owner_app_id:string}[];datasets:{app_id:string;table_name:string;can_read:number}[];users:{total:number;active:number};roles:number};
export default function CentralManagement({onChoose}:{onChoose:(app:Application,path:string)=>Promise<void>}){
 const {access}=useAuth(),params=useSearchParams(),requested=params.get('section')||'overview',section=SECTIONS.some(s=>s.id===requested)?requested:'overview';
 const [data,setData]=useState<Overview>(),[error,setError]=useState(''),[query,setQuery]=useState(''),[managing,setManaging]=useState<Application>(),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!access.owner)return;const abort=new AbortController();fetch('/api/applications?overview=1',{signal:abort.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);setError('');}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[access.owner,revision,section]);
 useEffect(()=>setQuery(''),[section]);
 if(!access.owner)return null;
 const roleApp=data?.apps.find(a=>a.id===params.get('app'))||data?.apps[0];
 const href=(id:string)=>'/apps?tab=central&section='+id;
 const appFor=(id:string)=>data?.apps.find(a=>a.id===id);
 return <section className="central-management" aria-label="การจัดการข้อมูลส่วนกลาง"><p className="central-scope-note"><Icon name="users"/>สำหรับเจ้าของ Builder / Admin สูงสุด · ข้อมูลส่วนนี้ใช้ร่วมกันทั้งระบบ</p><DraftBanner/><nav className="central-navigation" aria-label="เมนูข้อมูลส่วนกลาง">{SECTIONS.map(s=><Link key={s.id} href={href(s.id)} aria-current={section===s.id?'page':undefined}><Icon name={s.icon}/>{s.label}</Link>)}</nav>{error&&<p className="err" role="alert">{error}</p>}
 {['app-backups','files','usage'].includes(section)?<AppOperationsManager key={section} mode={section==='app-backups'?'backups':section as 'files'|'usage'}/>:section==='users'?<UsersManager central/>:section==='backups'?<BackupManager/>:section==='audit'?<AuditLogManager/>:!data&&!error?<p role="status">กำลังโหลดข้อมูลส่วนกลาง…</p>:data&&<>
 {section==='members'?<><div className="field central-role-app-picker"><label htmlFor="central-role-app">เลือกแอปเพื่อจัดการบทบาท</label><SearchSelect id="central-role-app" value={roleApp?.id||''} onChange={e=>{location.assign('/apps?tab=central&section=members&app='+encodeURIComponent(e.target.value));}}>{data.apps.map(app=><option value={app.id} key={app.id}>{app.label}</option>)}</SearchSelect></div>{roleApp&&<ApplicationRolesEditor key={roleApp.id} app={roleApp}/>}</>:section==='overview'?<><div className="central-stat-grid">{[[data.apps.length,'แอป'],[data.tables.length,'ตารางข้อมูล'],[data.users.total,'ผู้ใช้'],[data.roles,'บทบาท']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><div className="central-tool-grid">{SECTIONS.filter(s=>s.id!=='overview').map(s=><Link key={s.id} href={href(s.id)}><Icon name={s.icon}/><strong>{s.label}</strong><Icon name="chevron"/></Link>)}</div><p className="hint">จัดการบัญชีและข้อมูลร่วมกันจากหน้านี้ ส่วน View, Action, Automation และค่าตั้งค่าผู้ใช้อยู่ในการตั้งค่าของแต่ละแอป</p></>:<>
 <div className="central-section-heading"><div><h2>{section==='datasets'?'ตารางข้อมูลทั้งหมด':'แอปและการเชื่อมต่อ'}</h2><p className="hint">{section==='datasets'?'แสดงตารางของทุกแอป พร้อมแอปเจ้าของและแอปที่เชื่อมใช้งาน':'กำหนดสิทธิ์เข้าแอป สิทธิ์แก้ไขแอป และการเชื่อมตารางร่วมกัน'}</p></div><div className="search-box"><Icon name="search"/><input aria-label="ค้นหาข้อมูลส่วนกลาง" placeholder="ค้นหาชื่อ…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
 {section==='datasets'?<div className="scroll central-table-wrap"><table><thead><tr><th>ตาราง</th><th>แอปเจ้าของ</th><th>แอปที่เชื่อมใช้งาน</th><th>จัดการ</th></tr></thead><tbody>{data.tables.filter(t=>(t.label+' '+t.name+' '+(appFor(t.owner_app_id)?.label||'')).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(t=>{const owner=appFor(t.owner_app_id),linked=data.datasets.filter(g=>g.table_name===t.name&&g.can_read);return <tr key={t.name}><td><strong>{t.label}</strong><small>{t.name}</small></td><td>{owner?.label||t.owner_app_id}</td><td>{linked.map(g=>appFor(g.app_id)?.label||g.app_id).join(', ')||'—'}</td><td><button disabled={!owner} onClick={()=>owner&&void onChoose(owner,'/t/'+encodeURIComponent(t.name)+'/edit')}>จัดการตาราง</button></td></tr>;})}</tbody></table>{!data.tables.length&&<p className="hint">ยังไม่มีตารางข้อมูล</p>}</div>:<div className="central-app-grid">{data.apps.filter(a=>(a.label+' '+a.description).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(app=><article key={app.id}><h3>{app.label}</h3><p className="hint">{data.tables.filter(t=>t.owner_app_id===app.id).length} ตารางของแอป · เชื่อมอ่าน {data.datasets.filter(g=>g.app_id===app.id&&g.can_read).length} ตาราง</p><div className="row"><button onClick={()=>setManaging(app)}>ตารางและสิทธิ์ {app.label}</button><button onClick={()=>void onChoose(app,'/settings')}>ตั้งค่าแอป</button></div></article>)}</div>}
 </>}
 </>}{managing&&<ApplicationAccessEditor app={managing} onClose={()=>{setManaging(undefined);setRevision(r=>r+1);}} onCreateTable={()=>void onChoose(managing,'/data?new=1')}/>}</section>;
}
