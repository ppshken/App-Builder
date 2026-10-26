"use client";
import {createContext,useContext,type ReactNode} from "react";
import Icon from "./Icon";
import {RuntimeCloseContext} from "./RuntimeCloseButton";
export type PageCrumb={key:string;title:string;depth:number;current:boolean;disabled?:boolean};
export const RuntimePageStackContext=createContext<{breadcrumb?:boolean;entries:PageCrumb[];onSelect:(depth:number,key?:string)=>void;onClose:()=>void}|null>(null);
export default function RuntimePageTrail({closeLabel="ปิดหน้าที่เปิดซ้อนทั้งหมด",actions}:{closeLabel?:string;actions?:ReactNode}={}){const stack=useContext(RuntimePageStackContext),request=useContext(RuntimeCloseContext);if(!stack)return null;return <nav className={"runtime-page-trail"+(stack.breadcrumb?" runtime-record-breadcrumb":"")} aria-label="หน้าที่เปิดซ้อน"><div className="runtime-page-trail-items">{stack.entries.map(e=><button type="button" key={e.key} title={e.title} aria-label={e.title} aria-current={e.current?"page":undefined} disabled={e.current||e.disabled} onClick={()=>request(()=>stack.onSelect(e.depth,e.key))}><span>{e.title}</span></button>)}</div>{actions ? <div className="runtime-trail-actions">{actions}</div> : <button type="button" className="icon-button" aria-label={closeLabel} title={closeLabel} onClick={()=>request(stack.onClose)}><Icon name="close"/></button>}</nav>;}
