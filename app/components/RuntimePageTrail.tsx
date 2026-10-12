"use client";
import {createContext,useContext,type ReactNode} from "react";
import Icon from "./Icon";
export type PageCrumb={key:string;title:string;depth:number;current:boolean;disabled?:boolean};
export const RuntimePageStackContext=createContext<{entries:PageCrumb[];onSelect:(depth:number)=>void;onClose:()=>void}|null>(null);
export default function RuntimePageTrail({closeLabel="ปิดหน้าที่เปิดซ้อนทั้งหมด"}:{closeLabel?:string}={}){const stack=useContext(RuntimePageStackContext);if(!stack)return null;return <nav className="runtime-page-trail" aria-label="หน้าที่เปิดซ้อน"><div className="runtime-page-trail-items">{stack.entries.map(e=><button type="button" key={e.key} title={e.title} aria-current={e.current?"page":undefined} disabled={e.current||e.disabled} onClick={()=>stack.onSelect(e.depth)}><span>{e.title}</span></button>)}</div><button type="button" className="icon-button" aria-label={closeLabel} title={closeLabel} onClick={stack.onClose}><Icon name="close"/></button></nav>;}
