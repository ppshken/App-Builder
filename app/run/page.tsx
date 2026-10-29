"use client";
import RuntimePwa from "@/app/components/RuntimePwa";
import {runtimePath} from "@/lib/pwa";
import useRuntimeExit,{type NavigationGuard} from "../components/useRuntimeExit";
import ViewNotice from "../components/ViewNotice";
import WorkflowActivity from "@/app/components/WorkflowActivity";
import {RuntimeNestedGuards} from "@/app/components/RuntimeNestedGuards";
import {RuntimeHeaderHost} from "@/app/components/RuntimeHeaderHost";
import AppHeader from "@/app/components/AppHeader";
import EditorDialog from "@/app/components/EditorDialog";
import NavigationBar from "@/app/components/NavigationBar";
import {appendPageTrail,readPageTrail,pageStackOrigin,type PageEntry} from "@/lib/runtime-page-stack";
import {RuntimePageStackContext} from "@/app/components/RuntimePageTrail";

import {readFormSeed} from "@/lib/action-navigation";
import {useAuth,logout} from "@/app/components/AuthProvider";
import {runtimeJSON, clearRuntimeCache} from "@/lib/runtime-cache";
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { AppView, viewIcon, menuViewGroups } from "@/lib/views";
import AppLoading from "@/app/components/AppLoading";
import RuntimeTransition, {RuntimeRoute} from "@/app/components/RuntimeTransition";
import MyProfile from "@/app/components/MyProfile";
import UserSettingsEditor from "@/app/components/UserSettingsEditor";
import RuntimeViewRenderer from "@/app/components/RuntimeViewRenderer";
import Icon from "@/app/components/Icon";
import { useAppSettings } from "@/app/components/AppSettingsProvider";
export default function RunApp() {
  const { settings } = useAppSettings();
  const {user,access,expressionUser,application}=useAuth();
  useEffect(()=>{if(!user||window.parent!==window)return;const abort=new AbortController();const timer=setTimeout(()=>{fetch('/api/app-activity',{method:'POST',headers:{'x-nocode-route-app':application,'x-nocode-app':application},signal:abort.signal}).catch(()=>{});},300);return()=>{clearTimeout(timer);abort.abort();};},[user?.id,application]);
  const permissionSignature=JSON.stringify(access),permissionState=useRef({signature:permissionSignature,epoch:0});
  if(permissionState.current.signature!==permissionSignature)permissionState.current={signature:permissionSignature,epoch:permissionState.current.epoch+1};
  const permissionEpoch=permissionState.current.epoch;
  const [profileOpen,setProfileOpen]=useState(false);
  const [userSettingsOpen,setUserSettingsOpen]=useState(false),[notificationsOpen,setNotificationsOpen]=useState(false);
  const [headerHost,setHeaderHost]=useState<HTMLElement|null>(null);
  const [displayed,setDisplayed]=useState<RuntimeRoute|null>(null);
  const stableHeaderTitle=useRef("");
  const commitRoute=useCallback((route:RuntimeRoute)=>setDisplayed(route),[]);
  const [desktop,setDesktop]=useState(false),[navHeight,setNavHeight]=useState(70);
  const navRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const el=navRef.current;if(!el)return;const measure=()=>setNavHeight(Math.ceil(el.getBoundingClientRect().height));measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[desktop,settings.navigation]);
  useLayoutEffect(()=>{const media=matchMedia("(min-width:1024px)"),sync=()=>setDesktop(media.matches);sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);},[]);
  const [initialValues,setInitialValues]=useState<Record<string,unknown>|undefined>();
  const [trail,setTrail]=useState<PageEntry[]>([]);
  const [dashboardOrigin,setDashboardOrigin]=useState<PageEntry|null>(null);
  const [depth, setDepth] = useState(0), [success, setSuccess] = useState("");
  const pendingSuccess = useRef("");
  const navigationGuard = useRef<NavigationGuard | null>(null), restoringHistory = useRef(false);
  const historyDepth = useRef(0),queuedHistory=useRef<(()=>void)|null>(null);
  const primaryGuard=useRef<NavigationGuard|null>(null),nestedGuards=useRef(new Map<HTMLElement,NavigationGuard>());
  const registerGuard=useCallback((guard:NavigationGuard|null)=>{primaryGuard.current=guard;},[]);
  const registerNestedGuard=useCallback((element:HTMLElement,guard:NavigationGuard)=>{nestedGuards.current.set(element,guard);return()=>{if(nestedGuards.current.get(element)===guard)nestedGuards.current.delete(element);};},[]);
  navigationGuard.current=(proceed)=>{const nested=[...nestedGuards.current].filter(([el])=>el.isConnected&&!el.closest('[hidden],.runtime-background')).sort(([a],[b])=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?1:-1).map(([,guard])=>guard);const guards=[...nested,...(primaryGuard.current?[primaryGuard.current]:[])];const check=(index:number):boolean=>index>=guards.length||guards[index](()=>{if(check(index+1))proceed?.();})&&check(index+1);return check(0);};
  const [screen, setScreen] = useState<{ name: string; open: boolean; id?: number;title?:string }>({ name: "", open: false });
  const reportScreen = useCallback((name: string, open: boolean, id?: number,title?:string) => setScreen(previous => previous.name === name && previous.open === open && previous.id === id && previous.title === title ? previous : { name, open, id,title }), []);
  const [revision,setRevision] = useState(0), [visibilityRevision,setVisibilityRevision] = useState(0), [hidden,setHidden] = useState<string[]>([]);
  const dataChanged = useCallback(() => setVisibilityRevision(n=>n+1), []);
  const [views, setViews] = useState<AppView[]>([]), [current, setCurrent] = useState(""), [row, setRow] = useState<number | undefined>(), [email, setEmail] = useState(user?.email || ""), [menu, setMenu] = useState(false), [err, setErr] = useState(""), [loaded, setLoaded] = useState(false);
  const menuRef=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{if(!menu||desktop)return;const previous=document.activeElement as HTMLElement|null;menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({preventScroll:true});return()=>{if(previous?.isConnected&&document.activeElement?.closest('.runtime-menu'))previous.focus({preventScroll:true});};},[menu,desktop]);
  const menuExit=useRuntimeExit();
  const closeMenu=()=>desktop?setMenu(false):menuExit.request(()=>setMenu(false));
  const toggleMenu=()=>{if(menuExit.closing)return;if(menu)closeMenu();else setMenu(true);};
  const canNavigate=(proceed:()=>void)=>!navigationGuard.current||navigationGuard.current(proceed);
  useEffect(() => {
    const previousScrollRestoration=history.scrollRestoration;history.scrollRestoration="manual";
    const sync = (event?: PopStateEvent) => { if (restoringHistory.current) { restoringHistory.current = false;const resume=queuedHistory.current;queuedHistory.current=null;resume?.();return; }
      const targetDepth=event?.state?.nocodeDepth||0;
      if(event&&navigationGuard.current&&!navigationGuard.current(()=>{const resume=()=>history.go(targetDepth-historyDepth.current);if(restoringHistory.current)queuedHistory.current=resume;else resume();})){restoringHistory.current=true;history.go(historyDepth.current-targetDepth||1);return;} historyDepth.current = history.state?.nocodeDepth || 0; const p = new URLSearchParams(location.search); setDepth(history.state?.nocodeDepth || 0);setTrail(readPageTrail(history.state?.nocodeTrail));setDashboardOrigin(readPageTrail([history.state?.nocodeDashboardOrigin])[0]||null);setInitialValues(history.state?.nocodeInitialValues||readFormSeed(p.get("form_seed"))); setSuccess(pendingSuccess.current); pendingSuccess.current = ""; setCurrent(p.get("view") || ""); setEmail(user?.email || ""); const id = Number(p.get("row")); setRow(Number.isSafeInteger(id) && id > 0 ? id : undefined); };
    const initialUrl=new URL(location.href);if(application!=='default')initialUrl.searchParams.set('app',application);history.replaceState({ ...history.state, nocodeDepth: history.state?.nocodeDepth || 0 }, "", initialUrl.href); sync(); window.addEventListener("popstate", sync);
    return () => {window.removeEventListener("popstate", sync);history.scrollRestoration=previousScrollRestoration;};
  }, []);
  useEffect(() => { let active=true; runtimeJSON("/api/views?runtime=1",email,15000).then(j=>{if(!active)return;setViews(j.views);setHidden(j.hidden);setErr(j.errors.join(" · "));setLoaded(true);}).catch(e=>{if(active){setViews([]);setErr(e.message);setLoaded(true);}});return ()=>{active=false;};},[email,revision,visibilityRevision,permissionEpoch]);
  const [previewDraft,setPreviewDraft]=useState<{view:AppView;visible:boolean}|null>(null);
  useEffect(()=>{if(!access.builder||window.parent===window)return;const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=="nocode:preview-draft")return;setPreviewDraft(event.data.view?{view:event.data.view,visible:event.data.visible===true}:null);};window.addEventListener("message",receive);window.parent.postMessage({type:"nocode:preview-ready"},location.origin);return()=>window.removeEventListener("message",receive);},[access.builder]);
  const runtimeViews=previewDraft?[...views.filter(v=>v.name!==previewDraft.view.name),...(previewDraft.visible?[previewDraft.view]:[])].sort((a,b)=>a.pos-b.pos):views;
  const v = runtimeViews.find(v => v.name === current) || (!current ? runtimeViews.find(v=>v.name===settings.home_view&&["primary","menu"].includes(v.position)) || runtimeViews.find(v => v.position === "primary") || runtimeViews.find(v => v.position === "menu") : undefined);
  useEffect(() => { if (!v) setScreen({name:"",open:false}); },[v?.name]);
  useEffect(() => { if (v && window.parent !== window) window.parent.postMessage({ type: "nocode:preview-view", name: screen.name || v.name, row: screen.id }, location.origin); }, [v?.name, screen.name, screen.id]);
  function go(next: AppView, id?: number, values?:Record<string,unknown>,source?:AppView,dashboardOverride?:PageEntry|null) { if(!canNavigate(()=>go(next,id,values,source,dashboardOverride)))return; const nextTrail=appendPageTrail(trail,{view:v?.name||current,row,depth,title:screen.title||v?.label},{view:next,row:id},source); setTrail(nextTrail); const nextDashboardOrigin=v?.kind==="dashboard"&&(v.display?.dashboard_views?.includes(next.name)||!!id||["detail","form"].includes(next.kind))?{view:v.name,depth,title:v.label}:(["detail","form"].includes(next.kind)||id)?dashboardOrigin:dashboardOverride||null;setDashboardOrigin(nextDashboardOrigin); history.pushState({ nocodeDashboardOrigin:nextDashboardOrigin,nocodeTrail:nextTrail,nocodeDepth: depth + 1, nocodeInitialValues:values, nocodeDetailOrigin:(["detail","form"].includes(next.kind)||id)?(["detail","form"].includes(v?.kind||"")||row?history.state?.nocodeDetailOrigin:depth):undefined, nocodePrevious:{view:current||v?.name,row} }, "", `${runtimePath()}?view=${next.name}${application!=="default"||new URLSearchParams(location.search).has("app")?"&app="+encodeURIComponent(application):""}&as=${encodeURIComponent(email)}${id ? `&row=${id}` : ""}`); historyDepth.current = depth + 1; setDepth(depth + 1); setSuccess(""); setCurrent(next.name); setRow(id); setInitialValues(values); if(!desktop)closeMenu(); }
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==location.origin || event.source!==window.parent || event.data?.type!=="nocode:preview-navigate")return;
      const next=runtimeViews.find(x=>x.name===event.data.name); if(next)go(next);else if(access.builder&&typeof event.data.name==="string")setCurrent(event.data.name);
    };
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[runtimeViews,depth,email]);
  function openReference(table: string, id: number, kind:"detail"|"form"="detail",source?:AppView) {
    const target = runtimeViews.find(v => v.table_name === table && v.position === "ref" && v.kind === kind) || runtimeViews.find(v => v.table_name === table && (kind === "form" ? v.kind === "form" : ["detail", "list", "table"].includes(v.kind) && v.position!=="inline"));
    if (target) go(target, id,undefined,source); else setErr(kind==="form" ? "ยังไม่มี View ฟอร์มที่แสดงได้ของตารางนี้ กรุณาตรวจ Reference View และ Show_If" : "ยังไม่มี View รายละเอียดของตารางอ้างอิงนี้ กรุณาสร้าง Reference View ก่อน");
  }
  function returnToPrevious(message?: string) { if (depth > 0) { pendingSuccess.current = message || ""; history.back(); return; } const target = runtimeViews.find(x => x.table_name === v?.table_name && ["list", "table"].includes(x.kind) && x.position === "primary") || runtimeViews.find(x => x.table_name === v?.table_name && ["list", "table"].includes(x.kind)); if (target) { history.replaceState({ nocodeDepth: 0 }, "", `${runtimePath()}?view=${target.name}&as=${encodeURIComponent(email)}`); setCurrent(target.name); setRow(undefined);setTrail([]); setScreen({name:target.name,open:false}); setSuccess(message || ""); } }
  function closeAllDetails() {
    if(!canNavigate(closeAllDetails))return;
    const origin=history.state?.nocodeDetailOrigin;
    if(Number.isInteger(origin)&&origin>=0&&origin<depth){pendingSuccess.current="";history.go(origin-depth);return;}
    const target=runtimeViews.find(x=>x.table_name===v?.table_name&&["list","table"].includes(x.kind)&&x.position==="primary")||runtimeViews.find(x=>x.table_name===v?.table_name&&["list","table"].includes(x.kind)&&x.position!=="inline");
    if(target){history.replaceState({nocodeDepth:depth},"",runtimePath()+"?view="+encodeURIComponent(target.name)+"&as="+encodeURIComponent(email));setCurrent(target.name);setRow(undefined);setTrail([]);setInitialValues(undefined);setScreen({name:target.name,open:false});setSuccess("");}
  }
  function openSavedDetail(table:string,id:number,message:string){
    const previous=history.state?.nocodePrevious,previousView=runtimeViews.find(x=>x.name===previous?.view);
    if(depth>0&&previousView?.table_name===table&&previousView.kind==="detail"&&previous?.row===id){returnToPrevious(message);return;}
    const target=runtimeViews.find(x=>x.table_name===table&&x.kind==="detail"&&x.position==="ref")||runtimeViews.find(x=>x.table_name===table&&x.kind==="detail"&&x.position!=="inline")||runtimeViews.find(x=>x.table_name===table&&["list","table"].includes(x.kind)&&x.position!=="inline");
    if(!target){returnToPrevious(message);setErr("บันทึกแล้ว แต่ยังไม่มีหน้ารายละเอียดที่เปิดได้ กรุณาตรวจ View และ Show_If");return;}
    history.replaceState({...history.state,nocodeDepth:depth,nocodeInitialValues:undefined,nocodePrevious:undefined},"",runtimePath()+"?view="+target.name+"&as="+encodeURIComponent(email)+"&row="+id);
    setCurrent(target.name);setRow(id);setInitialValues(undefined);setSuccess(message);setMenu(false);
  }
  const displayedView=runtimeViews.find(x=>x.name===displayed?.view.name)||v;
  const origin=v?pageStackOrigin(trail,{view:v,row},runtimeViews):undefined;
  const backdrop=desktop&&displayedView&&["detail","form"].includes(displayedView.kind)?origin?.view:undefined;
  if(displayedView){if(!["detail","form"].includes(displayedView.kind))stableHeaderTitle.current=displayedView.label;else if(origin?.view)stableHeaderTitle.current=origin.view.label;}
  const dashboardTrailView=desktop&&backdrop?backdrop:displayedView&&!["detail","form"].includes(displayedView.kind)?displayedView:undefined;
  const dashboardParent=dashboardOrigin?runtimeViews.find(x=>x.name===dashboardOrigin.view&&x.kind==="dashboard"):undefined;
  const crumbs=trail.flatMap(e=>{const view=runtimeViews.find(x=>x.name===e.view);return view&&(["list","table","custom","map","chart","calendar","detail","form"].includes(view.kind)||e.row)?[{key:e.view+"-"+e.depth,title:e.title||view.label,depth:e.depth,current:false}]:[];});
  const breadcrumb=!!dashboardParent||trail.some(e=>runtimeViews.some(x=>x.name===e.view&&["list","table","custom","map","chart","calendar"].includes(x.kind)));
  const stack=(desktop||breadcrumb)&&screen.open&&v?{breadcrumb,entries:[...(dashboardParent&&dashboardOrigin?[{key:dashboardParent.name+"-"+dashboardOrigin.depth,title:dashboardParent.label,depth:dashboardOrigin.depth,current:false}]:[]),...crumbs.filter(e=>e.key!==dashboardParent?.name+"-"+dashboardOrigin?.depth),{key:v.name+"-"+depth,title:screen.title||displayedView?.label||v.label,depth,current:true}],onSelect:(targetDepth:number,key?:string)=>{const select=()=>{const source=dashboardOrigin&&targetDepth===dashboardOrigin.depth&&key!==dashboardParent?.name+"-"+dashboardOrigin.depth?trail.find(e=>e.view+"-"+e.depth===key):undefined;const sourceView=source?runtimeViews.find(x=>x.name===source.view):undefined;if(sourceView){go(sourceView,undefined,undefined,undefined,dashboardOrigin);return;}if(targetDepth>=depth)return;pendingSuccess.current="";history.go(targetDepth-depth);};if(canNavigate(select))select();},onClose:closeAllDetails}:null;
  return <div style={{"--runtime-nav-height":navHeight+"px"} as import("react").CSSProperties} className={`runtime-app runtime-responsive ${desktop?"runtime-desktop":""} ${settings.navigation.desktop==="bottom"?"runtime-bottom-nav":""} ${menu?"runtime-menu-expanded":"runtime-menu-collapsed"} ${backdrop?"desktop-detail-open":""} ${screen.open ? "screen-open" : ""}`}><RuntimePwa guard={proceed=>canNavigate(proceed)}/><WorkflowActivity onChange={dataChanged}/>{profileOpen&&<MyProfile onClose={()=>setProfileOpen(false)}/>}{userSettingsOpen&&<UserSettingsEditor onClose={()=>setUserSettingsOpen(false)}/>}<AppHeader screenHostRef={setHeaderHost} app={settings} settings={settings.header} viewTitle={stableHeaderTitle.current||displayedView?.label||"แอปของฉัน"} userName={user?.name} userSettings={expressionUser.userSettings} menuOpen={menu} onMenu={toggleMenu} onReload={()=>{clearRuntimeCache();setRevision(n=>n+1);}} onProfile={()=>setProfileOpen(true)} notificationsAvailable={!settings.header.notifications_view||runtimeViews.some(x=>x.name===settings.header.notifications_view)} onNotifications={()=>{const target=runtimeViews.find(x=>x.name===settings.header.notifications_view);if(target)go(target);else setNotificationsOpen(true);}}/>{notificationsOpen&&<EditorDialog title="การแจ้งเตือน" onClose={()=>setNotificationsOpen(false)}><p>ยังไม่ได้กำหนดหน้าแจ้งเตือน</p></EditorDialog>}
    {(desktop||menu) && <>{!desktop&&<button className="runtime-overlay" aria-label="ปิดเมนูนำทาง" onClick={closeMenu}/>}<nav ref={menuRef} tabIndex={-1} className={"runtime-menu "+(desktop?"desktop-menu-style-"+settings.navigation.desktop:"")} data-closing={menuExit.closing||undefined} aria-label="Menu Navigation" onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeMenu();}}}><h2>เมนูของแอป</h2>{menuViewGroups(runtimeViews.filter(v => (v.position === "menu" || desktop&&settings.navigation.desktop!=="bottom"&&v.position==="primary"))).map(group => <section className="runtime-menu-group" key={group.name}>{group.name&&<h3>{group.name}</h3>}{group.views.map(x => <button key={x.name} aria-current={(backdrop?.name||displayedView?.name)===x.name?"page":undefined} title={x.label} aria-label={x.label} onClick={() => go(x)}><Icon name={viewIcon(x)}/><span className="runtime-menu-label">{x.label}</span></button>)}</section>)}{!runtimeViews.some(v => v.position === "menu" || desktop&&settings.navigation.desktop!=="bottom"&&v.position==="primary") && <p className="hint">ยังไม่มี Menu View</p>}<div className="runtime-account"><button title="ติดตั้งแอพ" aria-label="ติดตั้งแอพ" onClick={()=>window.dispatchEvent(new Event("nocode:pwa-install"))}><Icon name="phone"/><span className="runtime-menu-label">ติดตั้งแอพ</span></button><small>{user?.name} · {email}</small><button title="แอปของฉัน" aria-label="แอปของฉัน" onClick={()=>{const open=()=>location.assign("/apps");if(canNavigate(open))open();}}><Icon name="grid"/><span className="runtime-menu-label">แอปของฉัน</span></button><button title="โปรไฟล์ของฉัน" aria-label="โปรไฟล์ของฉัน" onClick={()=>{if(!desktop)closeMenu();setProfileOpen(true);}}><Icon name="users"/><span className="runtime-menu-label">โปรไฟล์ของฉัน</span></button><button title="ค่าตั้งค่าของฉัน" aria-label="ค่าตั้งค่าของฉัน" onClick={()=>{if(!desktop)closeMenu();setUserSettingsOpen(true);}}><Icon name="settings"/><span className="runtime-menu-label">ค่าตั้งค่าของฉัน</span></button><button title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={()=>logout().catch(e=>setErr(e.message))}><Icon name="external"/><span className="runtime-menu-label">ออกจากระบบ</span></button><button title="ออกจากระบบทุกอุปกรณ์" aria-label="ออกจากระบบทุกอุปกรณ์" onClick={()=>logout(true).catch(e=>setErr(e.message))}><Icon name="users"/><span className="runtime-menu-label">ออกจากระบบทุกอุปกรณ์</span></button></div></nav></>}
    <RuntimeNestedGuards.Provider value={registerNestedGuard}><RuntimeHeaderHost.Provider value={desktop?null:headerHost}><RuntimePageStackContext.Provider value={stack}><main>{dashboardParent&&dashboardOrigin&&dashboardTrailView&&dashboardTrailView.name!==dashboardParent.name&&<nav className="runtime-dashboard-trail" aria-label="เส้นทางจาก Dashboard"><button type="button" onClick={()=>{if(navigationGuard.current&&!navigationGuard.current())return;pendingSuccess.current="";history.go(dashboardOrigin.depth-depth);}}>{dashboardParent.label}</button><Icon name="chevron" width="16" height="16"/><span aria-current="page">{dashboardTrailView.label}</span></nav>}{err && <ViewNotice status="error">{err}</ViewNotice>}{!loaded ? <AppLoading/> : v ? <RuntimeTransition desktop={desktop} backdrop={backdrop&&<div className="desktop-detail-backdrop"><RuntimeViewRenderer dataRevision={visibilityRevision} views={runtimeViews} table={backdrop.table_name} runtimeView={backdrop} selectedRow={origin?.row} referenceViews={runtimeViews.filter(x=>x.position==="ref")} previewEmail={email} onNavigate={(next,id,values)=>go(next,id,values,backdrop)} onOpenReference={(table,id,kind)=>openReference(table,id,kind,backdrop)}/></div>} route={{parents:trail,depth,key:v.name+"-"+v.kind+"-"+v.table_name+"-"+(v.slice_name||"")+"-"+(row||"new")+"-"+depth+"-"+revision+"-"+email+"-acl-"+permissionEpoch,view:v,row,initialValues,email,originView:origin?.view.name,originRow:origin?.row,cacheScope:revision+"-"+email+"-acl-"+permissionEpoch}} onCommit={commitRoute} render={(route,active,onReady,background)=><RuntimeViewRenderer dataRevision={visibilityRevision} views={runtimeViews} table={route.view.table_name} runtimeView={route.view} selectedRow={background?origin?.row:undefined} referenceViews={runtimeViews.filter(v=>v.position==="ref")} inlineViews={runtimeViews.filter(v=>v.position==="inline")} initialRow={route.row} initialValues={route.initialValues} previewEmail={route.email} onOpenReference={(table,id,kind,source)=>openReference(table,id,kind,source||(background?route.view:undefined))} onReady={onReady} onScreenChange={active?reportScreen:undefined} onReturn={returnToPrevious} onCloseDetails={closeAllDetails} onSavedDetail={openSavedDetail} onNavigate={(next,id,values,source)=>go(next,id,values,source||(background?route.view:undefined))} successMessage={active?success:""} registerNavigationGuard={active?registerGuard:undefined} onDataChange={dataChanged}/>}/> : <div className="panel empty">{current ? (hidden.includes(current)||previewDraft?.view.name===current&&!previewDraft.visible) ? "View นี้ถูกซ่อนด้วยเงื่อนไข Show_If กรุณาเลือกหน้าอื่น" : "ไม่พบ View นี้ กรุณาเลือกมุมมองใหม่" : access.builder ? "ยังไม่มีมุมมองหลัก กรุณาเพิ่ม Primary หรือ Menu View" : "ยังไม่มีหน้าที่บัญชีนี้เปิดได้ กรุณาติดต่อเจ้าของแอปเพื่อกำหนดสิทธิ์"}</div>}</main></RuntimePageStackContext.Provider></RuntimeHeaderHost.Provider></RuntimeNestedGuards.Provider>
    <NavigationBar ref={navRef} className="runtime-primary" items={runtimeViews.filter(x=>x.position==="primary").map(x=>({name:x.name,label:x.label,icon:viewIcon(x)}))} active={backdrop?.name||v?.name||""} settings={settings.navigation} onSelect={name=>{const next=runtimeViews.find(x=>x.name===name);if(next)go(next);}}/>
  </div>;
}
