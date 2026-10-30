"use client";
import {useLayoutEffect,useRef,useState,useId} from 'react';
import type {DetailFieldDisplay} from '@/lib/detail-field-config';
export default function DetailField({name,label,field={},showLabels=true,layout="vertical",columns=1,related=false,computed=false,value,children}:{name:string;label:string;field?:DetailFieldDisplay;showLabels?:boolean;layout?:string;columns?:number;related?:boolean;computed?:boolean;value?:unknown;children:React.ReactNode}){
 const [expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false),content=useRef<HTMLDivElement>(null),id=useId();
 const excerpt=field.presentation==='excerpt',visible=field.show_label??showLabels;
 useLayoutEffect(()=>{if(!excerpt||expanded)return;const node=content.current;if(!node)return;const measure=()=>setOverflow(node.scrollHeight>node.clientHeight+1);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[excerpt,expanded,value,field.lines]);
 const mode=field.presentation,restoreLayout=visible&&!showLabels&&['horizontal','edges'].includes(layout),align=field.align&&field.align!=='inherit'?field.align:mode==='vertical'?'left':mode==='edges'?'right':undefined;
 return <div data-detail-field={name} className={`${related?'detail-related-section ':''}detail-configured-field detail-presentation-${field.presentation||'inherit'} detail-field-labels-${visible?'visible':'hidden'} detail-field-align-${align||'inherit'}`} style={{gridColumn:field.width==='half'?'span 1':field.width==='full'||related||columns===1?'1 / -1':undefined,display:!visible||mode==='vertical'?'block':mode==='edges'||restoreLayout?'grid':undefined,gridTemplateColumns:mode==='edges'||restoreLayout?(mode==='edges'||layout==='edges'?'minmax(0,2fr) minmax(0,3fr)':'minmax(65px,.7fr) minmax(0,1fr)'):undefined}}>
  {!related&&<dt>{field.label?.trim()||label}{computed&&<span className="badge blue">คำนวณ</span>}</dt>}
  <dd style={{textAlign:align}} aria-label={!related&&!visible?(field.label?.trim()||label):undefined}>{excerpt?<><div id={id} ref={content} className={expanded?'detail-excerpt-expanded':'detail-excerpt-clamped'} style={{WebkitLineClamp:field.lines||3}}>{children}</div>{(overflow||expanded)&&<button type="button" className="detail-read-more" aria-controls={id} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'แสดงน้อยลง':'อ่านเพิ่มเติม'}</button>}</>:children}</dd>
 </div>;
}
