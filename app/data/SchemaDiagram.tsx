"use client";
import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import Icon from '../components/Icon';
import {CARD_WIDTH,ROW_HEIGHT,cardHeight,diagramEdges,layoutDiagram,visibleColumns,type DiagramTable,type Point} from '@/lib/schema-diagram';
import './schema-diagram.css';
export default function SchemaDiagram({tables,application}:{tables:DiagramTable[];application:string}){
 const edges=useMemo(()=>diagramEdges(tables),[tables]);
 const [moved,setMoved]=useState<Record<string,Point>>({}),[zoom,setZoom]=useState(1),[query,setQuery]=useState(''),[expanded,setExpanded]=useState<Record<string,boolean>>({}),[selected,setSelected]=useState('');
 const initial=useMemo(()=>layoutDiagram(tables,edges,expanded),[tables,edges,expanded]);
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{name:string;x:number;y:number;point:Point}|null>(null);
 const positions={...initial,...moved},term=query.trim().toLocaleLowerCase();
 const matches=tables.filter(t=>!term||[t.name,t.label,...t.columns.flatMap(c=>[c.name,c.label])].some(s=>s.toLocaleLowerCase().includes(term)));
 const shown=new Set(matches.map(t=>t.name)),edge=edges.find(e=>e.id===selected);
 const width=Math.max(700,...tables.map(t=>(positions[t.name]?.x??0)+CARD_WIDTH+100)),height=Math.max(500,...tables.map(t=>(positions[t.name]?.y??0)+cardHeight(t,expanded[t.name])+80));
 const label=(name:string)=>tables.find(t=>t.name===name)?.label||name;
 const fit=()=>{const el=viewport.current;if(el)setZoom(Math.max(.2,Math.min(1,(el.clientWidth-20)/width,(el.clientHeight-20)/height)));};
 return <section className="schema-diagram" aria-label="แผนผังตาราง">
 <div className="schema-toolbar"><div className="search-box"><input aria-label="ค้นหาในแผนผัง" placeholder="ค้นหาตารางหรือคอลัมน์…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="schema-tools"><button aria-label="ย่อแผนผัง" onClick={()=>setZoom(z=>Math.max(.2,z-.1))}>−</button><output>{Math.round(zoom*100)}%</output><button aria-label="ขยายแผนผัง" onClick={()=>setZoom(z=>Math.min(2,z+.1))}>+</button><button onClick={fit}>พอดีจอ</button><button onClick={()=>{setMoved({});setExpanded({});setZoom(1);}}>จัดเรียงใหม่</button></div></div>
 <div className="schema-legend"><span>{matches.length} ตาราง · {edges.length} ความสัมพันธ์</span><span>เส้นทึบ: Ref (หลาย → หนึ่ง) · เส้นประ: รายการอ้างอิง</span><span>ลากหัวตารางเพื่อย้าย · เลื่อนพื้นที่เพื่อดูแผนผัง</span></div>
 {!matches.length&&<p role="status">ไม่พบตารางหรือคอลัมน์ที่ค้นหา</p>}
 <div className="schema-viewport" ref={viewport} tabIndex={0} aria-label="พื้นที่แผนผัง เลื่อนเพื่อดูตาราง"><div style={{width:width*zoom,height:height*zoom}}><div className="schema-world" style={{width,height,transform:'scale('+zoom+')'}}>
 <svg className="schema-lines" width={width} height={height} aria-label="เส้นความสัมพันธ์"><defs><marker id="schema-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>{edges.filter(e=>e.available&&shown.has(e.source)&&shown.has(e.target)).map(e=>{
 const source=tables.find(t=>t.name===e.source)!,p=positions[e.source],q=positions[e.target];const cols=visibleColumns(source,expanded[source.name]),index=cols.findIndex(c=>c.name===e.column.name);const y=p.y+(index<0?cardHeight(source,false)-18:110+index*ROW_HEIGHT+16),right=q.x>=p.x;const x=p.x+(right?CARD_WIDTH:0),tx=q.x+(e.source===e.target?CARD_WIDTH:right?0:CARD_WIDTH),ty=q.y+94;const bend=e.source===e.target?x+75:(x+tx)/2;const d='M '+x+' '+y+' C '+bend+' '+y+', '+bend+' '+ty+', '+tx+' '+ty;
 return <g key={e.id} className={selected===e.id?'selected':''}><path d={d} className="schema-line-hit" onClick={()=>setSelected(e.id)}/><path d={d} className={'schema-line '+(!e.physical?'dashed':'')} markerEnd="url(#schema-arrow)"/><text x={x+(right?7:-16)} y={y-6}>{e.physical?'N':''}</text><text x={tx+(right?-14:8)} y={ty-6}>{e.physical?'1':''}</text></g>;
 })}</svg>
 {matches.map(t=><article key={t.name} className={'schema-card '+(edge&&(edge.source===t.name||edge.target===t.name)?'highlight':'')} style={{left:positions[t.name].x,top:positions[t.name].y,width:CARD_WIDTH}}>
 <header onPointerDown={e=>{if((e.target as HTMLElement).closest('a,button'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={name:t.name,x:e.clientX,y:e.clientY,point:positions[t.name]};}} onPointerMove={e=>{const d=drag.current;if(d?.name===t.name)setMoved(old=>({...old,[t.name]:{x:Math.max(0,d.point.x+(e.clientX-d.x)/zoom),y:Math.max(0,d.point.y+(e.clientY-d.y)/zoom)}}));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
 <Link href={'/t/'+t.name+'/edit'} title={'ตั้งค่าตาราง '+t.label}>{t.label}</Link><small title={t.name}>{t.name}</small><span className="schema-owner">{t.owner_app_id&&t.owner_app_id!==application?'ตารางใช้ร่วมกัน':'ตารางของแอป'}</span></header>
 <div className="schema-column schema-id"><span><Icon name="key" width="13" height="13"/></span><span>id <small>รหัสภายใน</small></span><small>number</small></div>
 {visibleColumns(t,expanded[t.name]).map(c=><div className="schema-column" key={c.name}><span title={c.is_key?'Key':c.is_virtual?'คำนวณ':c.type==='ref'?'Ref':''}>{c.is_key?<Icon name="key" width="13" height="13"/>:c.type==='ref'?'↗':c.is_virtual?'ƒ':'·'}</span><Link href={'/t/'+t.name+'/edit?column='+encodeURIComponent(c.name)} title={c.label+' ('+c.name+')'}>{c.label||c.name}{c.required?' *':''}</Link><small title={c.type}>{c.type}</small>{c.ref_table&&<button className="schema-ref" aria-label={'ความสัมพันธ์ '+t.name+'.'+c.name} onClick={()=>setSelected(t.name+':'+c.name)}>↗</button>}</div>)}
 {t.columns.length>10&&<button className="schema-more" onClick={()=>setExpanded(v=>({...v,[t.name]:!v[t.name]}))}>{expanded[t.name]?'ย่อคอลัมน์':'แสดงอีก '+(t.columns.length-10)+' คอลัมน์'}</button>}
 </article>)}
 </div></div></div>
 <details className="schema-relations"><summary>ความสัมพันธ์ทั้งหมด ({edges.length})</summary><div>{edges.map(e=><button key={e.id} onClick={()=>setSelected(e.id)}>{label(e.source)} · {e.column.label} → {label(e.target)}{!e.available?' (ไม่พร้อมใช้งาน)':''}</button>)}{!edges.length&&<p>ยังไม่มีคอลัมน์อ้างอิง</p>}</div></details>
 {edge&&<aside className="schema-detail" aria-label="รายละเอียดความสัมพันธ์"><button className="schema-detail-close" aria-label="ปิดรายละเอียดความสัมพันธ์" onClick={()=>setSelected('')}>×</button><strong>{label(edge.source)} → {label(edge.target)}</strong><p>{edge.column.label} <small>({edge.column.name}) · {edge.column.type}</small></p><p>{edge.physical?'หลายแถวในตารางลูก อ้างอิงหนึ่งแถวในตารางแม่ผ่าน id':'รายการอ้างอิง ไม่ใช่เส้น Ref แบบหนึ่งต่อหลาย'}</p>{!edge.available&&<p role="status">ตารางปลายทางไม่พร้อมใช้งานในสิทธิ์ของแอปนี้</p>}{edge.physical&&<p>ลบตามตารางแม่: {(edge.column.ref_delete_cascade||edge.column.is_part_of)?'เปิด':'ปิด'} · Is a part of: {edge.column.is_part_of?'เปิด':'ปิด'}</p>}<Link href={'/t/'+edge.source+'/edit?column='+encodeURIComponent(edge.column.name)}>ตั้งค่าคอลัมน์อ้างอิง →</Link></aside>}
 </section>;
}
