"use client";
import {useEffect,useRef,type ReactNode} from "react";
const plain=(v:any):string=>typeof v==='string'||typeof v==='number'?String(v):Array.isArray(v)?v.map(plain).join(''):v?.props?.children?plain(v.props.children):'';
export default function ViewNotice({children,status="error",floating=true}:{children:ReactNode;status?:"success"|"error"|"warning";floating?:boolean}) {
 const message=plain(children),last=useRef('');
 useEffect(()=>{if(floating&&message&&message!==last.current){last.current=message;window.dispatchEvent(new CustomEvent('nocode:view-notice',{detail:{message,state:status==='success'?'saved':status}}));}},[floating,message,status]);
 return floating?null:<div className={status+'-banner'} role={status==='error'?'alert':'status'}>{children}</div>;
}
