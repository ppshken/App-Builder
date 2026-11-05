"use client";
import {useEffect,useRef,useState} from 'react';
type Drag={id:number;target:string;group:HTMLElement;source:HTMLElement;ghost:HTMLElement;items:{key:string;node:HTMLElement;top:number;height:number}[];index:number;offset:number;scroll:number;y:number;frame:number;cleanup:()=>void};
export default function ColumnDragHandle({name,disabled,onMove}:{name:string;disabled:boolean;onMove:(target:string)=>void}){
 const drag=useRef<Drag|null>(null),[active,setActive]=useState(false);
 const finish=(commit=false)=>{const current=drag.current;if(!current)return;drag.current=null;current.cleanup();setActive(false);if(commit&&!disabled&&current.target!==name)onMove(current.target);};
 useEffect(()=>()=>{drag.current?.cleanup();drag.current=null;},[]);
 useEffect(()=>{if(disabled)finish();},[disabled]);
 function position(current:Drag){
  const {group,items,index}=current,delta=group.scrollTop-current.scroll;
  current.ghost.style.transform='translate3d(0,'+(current.y-current.offset)+'px,0)';
  const center=current.y-current.offset+items[index].height/2;
  let to=0;for(let i=0;i<items.length;i++){if(i===index)continue;if(center>=items[i].top-delta+items[i].height/2)to++;}
  current.target=items[to].key;
  items.forEach((item,i)=>{if(i===index)return;const shift=to>index&&i>index&&i<=to?-items[index].height:to<index&&i>=to&&i<index?items[index].height:0;item.node.style.transform='translate3d(0,'+shift+'px,0)';});
 }
 return <button type="button" className="icon-button column-drag-handle" aria-label={'ลากจัดลำดับ '+name} title="กดค้างแล้วลากเพื่อจัดลำดับ" disabled={disabled} aria-pressed={active}
 onPointerDown={e=>{
  if(disabled||e.button!==0)return;const group=e.currentTarget.closest<HTMLElement>('[data-column-sort]'),row=e.currentTarget.closest<HTMLElement>('[data-column-key]');if(!group||!row)return;
  e.preventDefault();finish();const items=Array.from(group.querySelectorAll<HTMLElement>('[data-column-key]')).map(r=>{const node=r.closest<HTMLElement>('.detail-column-item')||r,box=node.getBoundingClientRect();return {key:r.dataset.columnKey!,node,top:box.top,height:box.height};}),index=items.findIndex(i=>i.key===name);if(index<0)return;
  const source=items[index].node,box=source.getBoundingClientRect(),ghost=source.cloneNode(true) as HTMLElement;ghost.classList.add('column-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));Object.assign(ghost.style,{left:box.left+'px',width:box.width+'px',height:box.height+'px'});document.body.appendChild(ghost);
  const saved=items.map(i=>({node:i.node,transform:i.node.style.transform}));source.classList.add('column-drag-placeholder');items.forEach(i=>i.node.classList.add('column-sort-moving'));group.classList.add('column-sort-active');
  const current:Drag={id:e.pointerId,target:name,group,source,ghost,items,index,offset:e.clientY-box.top,scroll:group.scrollTop,y:e.clientY,frame:0,cleanup:()=>{cancelAnimationFrame(current.frame);ghost.remove();source.classList.remove('column-drag-placeholder');group.classList.remove('column-sort-active');saved.forEach(i=>{i.node.classList.remove('column-sort-moving');i.node.style.transform=i.transform;});}};
  drag.current=current;e.currentTarget.setPointerCapture(e.pointerId);setActive(true);position(current);
  const tick=()=>{if(drag.current!==current)return;const bounds=group.getBoundingClientRect();if(current.y<bounds.top+32)group.scrollTop-=8;else if(current.y>bounds.bottom-32)group.scrollTop+=8;position(current);current.frame=requestAnimationFrame(tick);};current.frame=requestAnimationFrame(tick);
 }}
 onPointerMove={e=>{const current=drag.current;if(!current||current.id!==e.pointerId)return;current.y=e.clientY;}}
 onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;drag.current.y=e.clientY;position(drag.current);finish(true);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
 onPointerCancel={()=>finish()} onLostPointerCapture={()=>finish()}>⠿</button>;
}
