"use client";
import {useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthProvider';
import {useAppSettings} from './AppSettingsProvider';
import EditorDialog from './EditorDialog';
import {pwaApplication,pwaBase} from '@/lib/pwa';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function RuntimePwa({guard}:{guard:(proceed:()=>void)=>boolean}){
 const {application}=useAuth(),{settings}=useAppSettings(),[open,setOpen]=useState(false),[install,setInstall]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[waiting,setWaiting]=useState<ServiceWorker|null>(null),[pending,setPending]=useState(false),[message,setMessage]=useState(''),registration=useRef<ServiceWorkerRegistration>();
 const guardRef=useRef(guard);guardRef.current=guard;
 useEffect(()=>{
  let active=true;const app=pwaApplication(location.pathname),base=pwaBase(application),standalone=()=>matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
  setInstalled(standalone());
  const show=()=>{if(!app){const go=()=>{const target=new URL(base,location.origin);target.search=location.search;target.searchParams.delete('app');target.searchParams.set('install','1');location.assign(target.href);};if(guardRef.current(go))go();return;}setOpen(true);};
  const prompt=(e:Event)=>{e.preventDefault();setInstall(e as InstallEvent);},done=()=>{setInstalled(true);setInstall(null);setMessage('ติดตั้งแอพแล้ว');},write=(e:Event)=>setPending(Number((e as CustomEvent).detail?.pending)>0);
  window.addEventListener('nocode:pwa-install',show);window.addEventListener('beforeinstallprompt',prompt);window.addEventListener('appinstalled',done);window.addEventListener('nocode:write-status',write);
  if(app&&new URLSearchParams(location.search).has('install')){setOpen(true);const url=new URL(location.href);url.searchParams.delete('install');history.replaceState(history.state,'',url.href);}
  let update:()=>void=()=>{},visibility:()=>void=()=>{};
  if(app&&window.isSecureContext&&'serviceWorker' in navigator){void navigator.serviceWorker.register(base+'sw.js',{scope:base,updateViaCache:'none'}).then(reg=>{
   if(!active)return;registration.current=reg;
   const check=()=>{if(active&&reg.waiting&&navigator.serviceWorker.controller)setWaiting(reg.waiting);};check();
   update=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',check);};reg.addEventListener('updatefound',update);
   let lastCheck=Date.now();visibility=()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck>60000){lastCheck=Date.now();void reg.update().catch(()=>{});}};document.addEventListener('visibilitychange',visibility);
  }).catch(()=>{if(active)setMessage('ยังเตรียมการติดตั้งไม่สำเร็จ กรุณาลองเปิดแอพอีกครั้ง');});}
  return()=>{active=false;registration.current?.removeEventListener('updatefound',update);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('nocode:pwa-install',show);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',done);window.removeEventListener('nocode:write-status',write);};
 },[application]);
 const update=()=>{if(pending||!waiting)return;const proceed=()=>{setWaiting(null);navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting.postMessage({type:'ACTIVATE_UPDATE'});};if(guard(proceed))proceed();};
 return <>{waiting&&<aside className="pwa-update" role="status"><span>มีแอพรุ่นใหม่พร้อมใช้งาน</span><button type="button" disabled={pending} onClick={update}>อัปเดต</button><button type="button" aria-label="อัปเดตภายหลัง" onClick={()=>setWaiting(null)}>ภายหลัง</button></aside>}{open&&<EditorDialog title={'ติดตั้ง '+settings.name} onClose={()=>{setOpen(false);setMessage('');}}><p>เพิ่มแอพนี้ไว้บนหน้าจอหลัก เพื่อเปิดเข้าแอพโดยตรง</p>{message&&<p role="status">{message}</p>}{installed?<p>กำลังใช้งานในโหมดแอพแล้ว</p>:!globalThis.isSecureContext?<p role="alert">ต้องเปิดผ่าน HTTPS ก่อนจึงจะติดตั้งและเตรียมหน้าออฟไลน์ได้</p>:install?<button type="button" className="primary" onClick={async()=>{try{await install.prompt();await install.userChoice;setInstall(null);}catch{setMessage('กรุณาติดตั้งผ่านเมนูของเบราว์เซอร์');}}}>ติดตั้งแอพนี้</button>:<><p><strong>iPhone / iPad:</strong> เปิดเมนูแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” และเปิดเป็นเว็บแอพ หากเบราว์เซอร์ไม่มีเมนูนี้ ให้เปิดลิงก์เดียวกันใน Safari</p><p><strong>Android / คอมพิวเตอร์:</strong> เปิดเมนูเบราว์เซอร์ แล้วเลือก “ติดตั้งแอพ” หรือ “เพิ่มไปยังหน้าจอหลัก”</p></>}<p className="hint">ระยะนี้ต้องใช้อินเทอร์เน็ตในการอ่านและบันทึกข้อมูล การเข้าสู่ระบบยังใช้บัญชีและสิทธิ์เดิมของคุณ</p></EditorDialog>}</>;
}
