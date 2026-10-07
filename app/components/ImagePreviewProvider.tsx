"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import Icon from "./Icon";
const Context=createContext<(src:string,label:string)=>void>(()=>{});
export const useImagePreview=()=>useContext(Context);
export default function ImagePreviewProvider({children}:{children:React.ReactNode}) {
 const [image,setImage]=useState<{src:string;label:string}|null>(null),[zoom,setZoom]=useState(false),[failed,setFailed]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!image)return;const el=dialog.current!;el.showModal();return()=>el.close();},[image]);
 const close=()=>setImage(null);
 return <Context.Provider value={(src,label)=>{setZoom(false);setFailed(false);setImage({src,label});}}>{children}{image&&<dialog ref={dialog} className="image-preview-dialog" aria-label={`ภาพขยาย ${image.label}`} onCancel={e=>{e.preventDefault();close();}}><header><button className="icon-button" aria-label="ปิดภาพขยาย" onClick={close}><Icon name="back"/></button><h2>{image.label}</h2><button disabled={failed} aria-pressed={zoom} onClick={()=>setZoom(v=>!v)}>{zoom?"พอดีหน้าจอ":"ขยายภาพ"}</button></header><div className={`image-preview-body ${zoom?"image-preview-zoomed":""}`} onClick={e=>{if(e.target===e.currentTarget)close();}}>{failed?<p role="alert">โหลดรูปภาพไม่ได้ กรุณาปิดภาพแล้วลองใหม่</p>:<img src={image.src} alt={image.label} onError={()=>setFailed(true)}/>}</div></dialog>}</Context.Provider>;
}
