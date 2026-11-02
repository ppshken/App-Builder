"use client";
import {useId,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {detailTabGroups,type DetailTab} from '@/lib/detail-tabs';
export default function DetailTabs({items,tabs=[],style,className,appearance='underline'}:{items:{key:string;node:ReactNode}[];tabs?:DetailTab[];style?:CSSProperties;className:string;appearance?:'underline'|'pills'}){
 const [selected,setSelected]=useState(''),id=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 if(!tabs.length)return <dl className={className} style={style}>{items.map(item=>item.node)}</dl>;
 const groups=detailTabGroups(items,tabs),active=groups.some(t=>t.id===selected)?selected:groups[0]?.id;
 return <div className={'detail-tabs detail-tabs-'+appearance}><div className="detail-tab-bar" role="tablist" aria-label="หมวดรายละเอียด">{groups.map((tab,index)=><button type="button" key={tab.id} ref={el=>{buttons.current[index]=el;}} role="tab" id={id+'-tab-'+tab.id} aria-controls={id+'-panel-'+tab.id} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>setSelected(tab.id)} onKeyDown={e=>{const next=e.key==='ArrowRight'?(index+1)%groups.length:e.key==='ArrowLeft'?(index+groups.length-1)%groups.length:e.key==='Home'?0:e.key==='End'?groups.length-1:-1;if(next>=0){e.preventDefault();setSelected(groups[next].id);buttons.current[next]?.focus();}}}>{tab.label}<span>{tab.items.length}</span></button>)}</div>{groups.map(tab=><section key={tab.id} role="tabpanel" id={id+'-panel-'+tab.id} aria-labelledby={id+'-tab-'+tab.id} hidden={active!==tab.id}><dl className={className} style={style}>{tab.items.map(item=>item.node)}</dl></section>)}</div>;
}
