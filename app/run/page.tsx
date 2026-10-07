"use client";
import AppIcon from "@/app/components/AppIcon";

import {readFormSeed} from "@/lib/action-navigation";
import {useAuth,logout} from "@/app/components/AuthProvider";
import {runtimeJSON, clearRuntimeCache} from "@/lib/runtime-cache";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppView, viewIcon } from "@/lib/views";
import AppLoading from "@/app/components/AppLoading";
import RuntimeTransition, {RuntimeRoute} from "@/app/components/RuntimeTransition";
import UserSettingsEditor from "@/app/components/UserSettingsEditor";
import RuntimeViewRenderer from "@/app/components/RuntimeViewRenderer";
import Icon from "@/app/components/Icon";
import { useAppSettings } from "@/app/components/AppSettingsProvider";
export default function RunApp() {
  const { settings } = useAppSettings();
  const {user,access}=useAuth();
  const [userSettingsOpen,setUserSettingsOpen]=useState(false);
  const [displayed,setDisplayed]=useState<RuntimeRoute|null>(null);
  const commitRoute=useCallback((route:RuntimeRoute)=>setDisplayed(route),[]);
  const [desktop,setDesktop]=useState(false),[navHeight,setNavHeight]=useState(70);
  const navRef=useRef<HTMLElement>(null);
  useEffect(()=>{const el=navRef.current;if(!el)return;const observer=new ResizeObserver(()=>setNavHeight(Math.ceil(el.getBoundingClientRect().height)));observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{const media=matchMedia("(min-width:1024px)"),sync=()=>setDesktop(media.matches);sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);},[]);
  const [initialValues,setInitialValues]=useState<Record<string,unknown>|undefined>();
  const [depth, setDepth] = useState(0), [success, setSuccess] = useState("");
  const pendingSuccess = useRef("");
  const navigationGuard = useRef<(() => boolean) | null>(null), restoringHistory = useRef(false);
  const historyDepth = useRef(0);
  const registerGuard = useCallback((guard: (() => boolean) | null) => { navigationGuard.current = guard; }, []);
  const [screen, setScreen] = useState<{ name: string; open: boolean; id?: number }>({ name: "", open: false });
  const reportScreen = useCallback((name: string, open: boolean, id?: number) => setScreen(previous => previous.name === name && previous.open === open && previous.id === id ? previous : { name, open, id }), []);
  const [revision,setRevision] = useState(0), [visibilityRevision,setVisibilityRevision] = useState(0), [hidden,setHidden] = useState<string[]>([]);
  const dataChanged = useCallback(() => setVisibilityRevision(n=>n+1), []);
  const [views, setViews] = useState<AppView[]>([]), [current, setCurrent] = useState(""), [row, setRow] = useState<number | undefined>(), [email, setEmail] = useState(user?.email || ""), [menu, setMenu] = useState(false), [err, setErr] = useState(""), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const previousScrollRestoration=history.scrollRestoration;history.scrollRestoration="manual";
    const sync = (event?: PopStateEvent) => { if (restoringHistory.current) { restoringHistory.current = false; return; } if (event && navigationGuard.current && !navigationGuard.current()) { restoringHistory.current = true; history.go((event.state?.nocodeDepth || 0) < (historyDepth.current) ? 1 : -1); return; } historyDepth.current = history.state?.nocodeDepth || 0; const p = new URLSearchParams(location.search); setDepth(history.state?.nocodeDepth || 0);setInitialValues(history.state?.nocodeInitialValues||readFormSeed(p.get("form_seed"))); setSuccess(pendingSuccess.current); pendingSuccess.current = ""; setCurrent(p.get("view") || ""); setEmail(user?.email || ""); const id = Number(p.get("row")); setRow(Number.isSafeInteger(id) && id > 0 ? id : undefined); };
    history.replaceState({ ...history.state, nocodeDepth: history.state?.nocodeDepth || 0 }, "", location.href); sync(); window.addEventListener("popstate", sync);
    return () => {window.removeEventListener("popstate", sync);history.scrollRestoration=previousScrollRestoration;};
  }, []);
  useEffect(() => { let active=true; runtimeJSON("/api/views?runtime=1",email,15000).then(j=>{if(!active)return;setViews(j.views);setHidden(j.hidden);setErr(j.errors.join(" · "));setLoaded(true);}).catch(e=>{if(active){setViews([]);setErr(e.message);setLoaded(true);}});return ()=>{active=false;};},[email,revision,visibilityRevision]);
  const [previewDraft,setPreviewDraft]=useState<{view:AppView;visible:boolean}|null>(null);
  useEffect(()=>{if(!access.builder||window.parent===window)return;const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=="nocode:preview-draft")return;setPreviewDraft(event.data.view?{view:event.data.view,visible:event.data.visible===true}:null);};window.addEventListener("message",receive);window.parent.postMessage({type:"nocode:preview-ready"},location.origin);return()=>window.removeEventListener("message",receive);},[access.builder]);
  const runtimeViews=previewDraft?[...views.filter(v=>v.name!==previewDraft.view.name),...(previewDraft.visible?[previewDraft.view]:[])].sort((a,b)=>a.pos-b.pos):views;
  const v = runtimeViews.find(v => v.name === current) || (!current ? runtimeViews.find(v=>v.name===settings.home_view&&["primary","menu"].includes(v.position)) || runtimeViews.find(v => v.position === "primary") || runtimeViews.find(v => v.position === "menu") : undefined);
  useEffect(() => { if (!v) setScreen({name:"",open:false}); },[v?.name]);
  useEffect(() => { if (v && window.parent !== window) window.parent.postMessage({ type: "nocode:preview-view", name: screen.name || v.name, row: screen.id }, location.origin); }, [v?.name, screen.name, screen.id]);
  function go(next: AppView, id?: number, values?:Record<string,unknown>) { if(navigationGuard.current&&!navigationGuard.current())return; history.pushState({ nocodeDepth: depth + 1, nocodeInitialValues:values, nocodeDetailOrigin:(["detail","form"].includes(next.kind)||id)?(["detail","form"].includes(v?.kind||"")||row?history.state?.nocodeDetailOrigin:depth):undefined, nocodePrevious:{view:current||v?.name,row} }, "", `/run?view=${next.name}&as=${encodeURIComponent(email)}${id ? `&row=${id}` : ""}`); historyDepth.current = depth + 1; setDepth(depth + 1); setSuccess(""); setCurrent(next.name); setRow(id); setInitialValues(values); setMenu(false); }
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==location.origin || event.source!==window.parent || event.data?.type!=="nocode:preview-navigate")return;
      const next=runtimeViews.find(x=>x.name===event.data.name); if(next)go(next);else if(access.builder&&typeof event.data.name==="string")setCurrent(event.data.name);
    };
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[runtimeViews,depth,email]);
  function openReference(table: string, id: number, kind:"detail"|"form"="detail") {
    const target = runtimeViews.find(v => v.table_name === table && v.position === "ref" && v.kind === kind) || runtimeViews.find(v => v.table_name === table && (kind === "form" ? v.kind === "form" : ["detail", "list", "table"].includes(v.kind) && v.position!=="inline"));
    if (target) go(target, id); else setErr(kind==="form" ? "ยังไม่มี View ฟอร์มที่แสดงได้ของตารางนี้ กรุณาตรวจ Reference View และ Show_If" : "ยังไม่มี View รายละเอียดของตารางอ้างอิงนี้ กรุณาสร้าง Reference View ก่อน");
  }
  function returnToPrevious(message?: string) { if (depth > 0) { pendingSuccess.current = message || ""; history.back(); return; } const target = runtimeViews.find(x => x.table_name === v?.table_name && ["list", "table"].includes(x.kind) && x.position === "primary") || runtimeViews.find(x => x.table_name === v?.table_name && ["list", "table"].includes(x.kind)); if (target) { history.replaceState({ nocodeDepth: 0 }, "", `/run?view=${target.name}&as=${encodeURIComponent(email)}`); setCurrent(target.name); setRow(undefined); setScreen({name:target.name,open:false}); setSuccess(message || ""); } }
  function closeAllDetails() {
    if(navigationGuard.current&&!navigationGuard.current())return;
    const origin=history.state?.nocodeDetailOrigin;
    if(Number.isInteger(origin)&&origin>=0&&origin<depth){pendingSuccess.current="";history.go(origin-depth);return;}
    const target=runtimeViews.find(x=>x.table_name===v?.table_name&&["list","table"].includes(x.kind)&&x.position==="primary")||runtimeViews.find(x=>x.table_name===v?.table_name&&["list","table"].includes(x.kind)&&x.position!=="inline");
    if(target){history.replaceState({nocodeDepth:depth},"","/run?view="+encodeURIComponent(target.name)+"&as="+encodeURIComponent(email));setCurrent(target.name);setRow(undefined);setInitialValues(undefined);setScreen({name:target.name,open:false});setSuccess("");}
  }
  function openSavedDetail(table:string,id:number,message:string){
    const previous=history.state?.nocodePrevious,previousView=runtimeViews.find(x=>x.name===previous?.view);
    if(depth>0&&previousView?.table_name===table&&previousView.kind==="detail"&&previous?.row===id){returnToPrevious(message);return;}
    const target=runtimeViews.find(x=>x.table_name===table&&x.kind==="detail"&&x.position==="ref")||runtimeViews.find(x=>x.table_name===table&&x.kind==="detail"&&x.position!=="inline")||runtimeViews.find(x=>x.table_name===table&&["list","table"].includes(x.kind)&&x.position!=="inline");
    if(!target){returnToPrevious(message);setErr("บันทึกแล้ว แต่ยังไม่มีหน้ารายละเอียดที่เปิดได้ กรุณาตรวจ View และ Show_If");return;}
    history.replaceState({...history.state,nocodeDepth:depth,nocodeInitialValues:undefined,nocodePrevious:undefined},"","/run?view="+target.name+"&as="+encodeURIComponent(email)+"&row="+id);
    setCurrent(target.name);setRow(id);setInitialValues(undefined);setSuccess(message);setMenu(false);
  }
  const displayedView=runtimeViews.find(x=>x.name===displayed?.view.name)||v;
  const backdrop=desktop&&displayedView&&["detail","form"].includes(displayedView.kind)?runtimeViews.find(x=>x.table_name===displayedView.table_name&&["list","table"].includes(x.kind)&&x.position!=="inline"):undefined;
  return <div style={{"--runtime-nav-height":navHeight+"px"} as import("react").CSSProperties} className={`runtime-app ${desktop?"runtime-desktop":""} ${backdrop?"desktop-detail-open":""} ${screen.open ? "screen-open" : ""}`}>{userSettingsOpen&&<UserSettingsEditor onClose={()=>setUserSettingsOpen(false)}/>}<header className="runtime-header"><button className="icon-button" aria-label={menu ? "ปิดเมนูแอป" : "เปิดเมนูแอป"} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="menu"/></button><div className="runtime-brand"><span className="runtime-app-icon"><AppIcon settings={settings}/></span><div><small>{settings.name}</small><h1>{displayedView?.label || "แอปของฉัน"}</h1></div></div><button className="icon-button" aria-label="โหลดข้อมูลใหม่" onClick={()=>{clearRuntimeCache();setRevision(n=>n+1);}}><Icon name="refresh"/></button></header>
    {menu && <><button className="runtime-overlay" aria-label="ปิดเมนูนำทาง" onClick={() => setMenu(false)}/><nav className="runtime-menu" aria-label="Menu Navigation"><h2>เมนูของแอป</h2>{runtimeViews.filter(v => (v.position === "menu" || desktop&&v.position==="primary")).map(x => <button key={x.name} aria-current={(screen.name||displayedView?.name)===x.name||backdrop?.name===x.name?"page":undefined} onClick={() => go(x)}><Icon name={viewIcon(x)}/>{x.label}</button>)}{!runtimeViews.some(v => v.position === "menu" || desktop&&v.position==="primary") && <p className="hint">ยังไม่มี Menu View</p>}<div className="runtime-account"><small>{user?.name} · {email}</small><button onClick={()=>{setMenu(false);setUserSettingsOpen(true);}}>ค่าตั้งค่าของฉัน</button><button onClick={()=>logout().catch(e=>setErr(e.message))}>ออกจากระบบ</button><button onClick={()=>logout(true).catch(e=>setErr(e.message))}>ออกจากระบบทุกอุปกรณ์</button></div></nav></>}
    <main>{err && <div className="error-banner" role="alert">{err}</div>}{!loaded ? <AppLoading/> : v ? <RuntimeTransition desktop={desktop} backdrop={backdrop&&<div className="desktop-detail-backdrop"><RuntimeViewRenderer dataRevision={visibilityRevision} views={runtimeViews} table={backdrop.table_name} runtimeView={backdrop} referenceViews={runtimeViews.filter(x=>x.position==="ref")} previewEmail={email} onNavigate={go} onOpenReference={openReference}/></div>} route={{key:v.name+"-"+v.kind+"-"+v.table_name+"-"+(v.slice_name||"")+"-"+(row||"new")+"-"+depth+"-"+revision+"-"+email,view:v,row,initialValues,email,cacheScope:revision+"-"+email}} onCommit={commitRoute} render={(route,active,onReady)=><RuntimeViewRenderer dataRevision={visibilityRevision} views={runtimeViews} table={route.view.table_name} runtimeView={route.view} referenceViews={runtimeViews.filter(v=>v.position==="ref")} inlineViews={runtimeViews.filter(v=>v.position==="inline")} initialRow={route.row} initialValues={route.initialValues} previewEmail={route.email} onOpenReference={openReference} onReady={onReady} onScreenChange={active?reportScreen:undefined} onReturn={returnToPrevious} onCloseDetails={closeAllDetails} onSavedDetail={openSavedDetail} onNavigate={go} successMessage={active?success:""} registerNavigationGuard={active?registerGuard:undefined} onDataChange={dataChanged}/>}/> : <div className="panel empty">{current ? (hidden.includes(current)||previewDraft?.view.name===current&&!previewDraft.visible) ? "View นี้ถูกซ่อนด้วยเงื่อนไข Show_If กรุณาเลือกหน้าอื่น" : "ไม่พบ View นี้ กรุณาเลือกมุมมองใหม่" : access.builder ? "ยังไม่มีมุมมองหลัก กรุณาเพิ่ม Primary หรือ Menu View" : "ยังไม่มีหน้าที่บัญชีนี้เปิดได้ กรุณาติดต่อเจ้าของแอปเพื่อกำหนดสิทธิ์"}</div>}</main>
    <nav ref={navRef} className="runtime-primary" aria-label="Primary Navigation">{runtimeViews.filter(v => v.position === "primary").map(x => <button aria-current={v?.name === x.name ? "page" : undefined} key={x.name} onClick={() => go(x)}><Icon name={viewIcon(x)}/><span>{x.label}</span></button>)}</nav>
  </div>;
}
