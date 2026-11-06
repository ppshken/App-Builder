"use client";
import {useState} from 'react';
import type {AppView} from '@/lib/views';
import type {Column} from '@/lib/columns';
import type {RelatedList} from '@/lib/lists';
import {detailItemOrder,type ViewDisplay} from '@/lib/view-display';
import {DETAIL_PRESENTATIONS,type DetailFieldDisplay} from '@/lib/detail-field-config';
import SearchSelect from './SearchSelect';
import ColumnDragHandle from './ColumnDragHandle';
import Icon from './Icon';
export default function DetailColumnEditor({view,cols,related=[],busy,onChange}:{view:AppView;cols:Column[];related?:RelatedList[];busy:boolean;onChange:(patch:Partial<AppView>)=>void}){
 const [query,setQuery]=useState(''),[open,setOpen]=useState<string|null>(null),d=view.display||{},selectedCols=view.columns.length?view.columns:cols.map(c=>c.name);
 const items=[...cols.map(c=>({name:c.name,label:c.label,type:c.type,computed:!!c.is_virtual,related:false,key:''})),...related.map(r=>({name:`related:${r.table}:${r.column}`,label:d.related?.[`${r.table}:${r.column}`]?.title||r.label,type:'related',computed:false,related:true,key:`${r.table}:${r.column}`}))];
 const selected=detailItemOrder([...selectedCols,...items.filter(i=>i.related&&d.related?.[i.key]?.visible!==false).map(i=>i.name)],d.detail_order);
 const ordered=[...selected.map(n=>items.find(i=>i.name===n)).filter((i):i is typeof items[number]=>!!i),...items.filter(i=>!selected.includes(i.name))];
 const patch=(display:ViewDisplay,columns=view.columns)=>onChange({columns,display});
 const fieldPatch=(name:string,p:Partial<DetailFieldDisplay>)=>patch({...d,detail_fields:{...d.detail_fields,[name]:{...d.detail_fields?.[name],...p}}});
 function move(index:number,delta:number){const order=[...selected];[order[index],order[index+delta]]=[order[index+delta],order[index]];patch({...d,detail_order:order},order.filter(n=>!n.startsWith('related:')));}
 return <div className="detail-column-editor">
  <div className="designer-column-mode" role="group" aria-label="การจัดคอลัมน์รายละเอียด"><button disabled={busy} aria-pressed={!view.columns.length} onClick={()=>patch({...d,detail_order:[]},[])}>อัตโนมัติ</button><button disabled={busy} aria-pressed={!!view.columns.length} onClick={()=>{if(!view.columns.length)patch({...d},cols.map(c=>c.name));}}>กำหนดเอง</button></div>
  {!view.columns.length?<p className="hint">แสดงทุกคอลัมน์ตามโครงสร้างตาราง · เลือกกำหนดเองเพื่อจัดลำดับและตั้งค่ารายช่อง</p>:<>
   <div className="search-box detail-column-search"><Icon name="search"/><input aria-label="ค้นหาคอลัมน์รายละเอียด" placeholder="ค้นหาคอลัมน์ หรือ Related…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   {query.trim()&&<p className="hint">ค้นหาไม่เปลี่ยนลำดับ · ล้างคำค้นหาเพื่อย้ายลำดับ</p>}
   <div className="designer-column-list view-column-picker detail-column-picker" data-column-sort role="group" aria-label="เลือกและจัดลำดับคอลัมน์รายละเอียด">{ordered.filter(i=>(i.label+' '+i.name).toLowerCase().includes(query.trim().toLowerCase())).map(item=>{
    const index=selected.indexOf(item.name),checked=index>=0,f=d.detail_fields?.[item.name]||{},title=item.label;
    const select=(label:string,value:string,options:readonly (readonly [string,string])[],change:(v:string)=>void)=><label>{label}<SearchSelect aria-label={label+' · '+title} value={value} disabled={busy} onChange={e=>change(e.target.value)}>{options.map(([v,text])=><option key={v} value={v}>{text}</option>)}</SearchSelect></label>;
    return <div key={item.name} className="detail-column-item"><div className="view-column-picker-row" data-column-key={checked?item.name:undefined}><ColumnDragHandle name={item.name} disabled={busy||!checked||!!query.trim()} onMove={target=>{const from=selected.indexOf(item.name),to=selected.indexOf(target);if(from<0||to<0)return;const order=[...selected];order.splice(to,0,...order.splice(from,1));patch({...d,detail_order:order},order.filter(n=>!n.startsWith('related:')));}}/><label title={item.name}><input type="checkbox" aria-label={'แสดง '+item.name} checked={checked} disabled={busy||checked&&!item.related&&selectedCols.length===1} onChange={e=>{
     const order=e.target.checked?[...selected,item.name]:selected.filter(n=>n!==item.name);
     patch({...d,detail_order:order,...(item.related?{related:{...d.related,[item.key]:{...d.related?.[item.key],visible:e.target.checked}}}:{})},order.filter(n=>!n.startsWith('related:')));
    }}/><span title={title} className="view-column-title"><span className="view-column-title-text">{checked?index+1+'. ':''}{title}</span>{item.related&&<small> · Related / Inline</small>}{item.computed&&<small className="computed-column-tag">คอลัมน์คำนวณ</small>}</span></label>
    <button type="button" className="icon-button" aria-label={'เลื่อน '+item.name+' ขึ้น'} title="เลื่อนขึ้น" disabled={busy||!checked||index===0||!!query.trim()} onClick={()=>move(index,-1)}>↑</button><button type="button" className="icon-button" aria-label={'เลื่อน '+item.name+' ลง'} title="เลื่อนลง" disabled={busy||!checked||index===selected.length-1||!!query.trim()} onClick={()=>move(index,1)}>↓</button><button type="button" className="icon-button" aria-label={'ตั้งค่าการแสดงผล '+item.name} aria-expanded={open===item.name} disabled={busy||!checked} onClick={()=>setOpen(old=>old===item.name?null:item.name)}><Icon name="settings"/></button></div>
    {open===item.name&&checked&&<div className="detail-column-options" role="group" aria-label={'การแสดงผล '+title}>
     {!item.related&&select('รูปแบบ',f.presentation||'inherit',DETAIL_PRESENTATIONS.filter(([v])=>v!=='excerpt'||['text','longtext'].includes(item.type)),v=>fieldPatch(item.name,{presentation:v as DetailFieldDisplay['presentation']}))}
     {select('ความกว้าง',f.width||'inherit',[['inherit','ตามค่าของหน้า'],['half','ครึ่งแถว'],['full','เต็มแถว']],v=>fieldPatch(item.name,{width:v as DetailFieldDisplay['width']}))}
     <label>ชื่อที่แสดง<input aria-label={'ชื่อที่แสดง · '+title} maxLength={100} value={item.related?d.related?.[item.key]?.title||'':f.label||''} placeholder={item.label} disabled={busy} onChange={e=>item.related?patch({...d,related:{...d.related,[item.key]:{...d.related?.[item.key],title:e.target.value}}}):fieldPatch(item.name,{label:e.target.value})}/></label>
     {!item.related&&<>
      {select('แสดงชื่อคอลัมน์',f.show_label===undefined?'inherit':String(f.show_label),[['inherit','ตามค่าของหน้า'],['true','แสดง'],['false','ซ่อน']],v=>fieldPatch(item.name,{show_label:v==='inherit'?undefined:v==='true'}))}
      {select('จัดแนวข้อมูล',f.align||'inherit',[['inherit','ตามค่าของหน้า'],['left','ซ้าย'],['center','กลาง'],['right','ขวา']],v=>fieldPatch(item.name,{align:v as DetailFieldDisplay['align']}))}
      {select('เมื่อไม่มีข้อมูล',f.hide_empty===undefined?'inherit':String(f.hide_empty),[['inherit','ตามค่าของหน้า'],['true','ซ่อนช่อง'],['false','แสดงช่อง']],v=>fieldPatch(item.name,{hide_empty:v==='inherit'?undefined:v==='true'}))}
      {f.presentation==='excerpt'&&<label>จำนวนบรรทัด<input type="number" aria-label={'จำนวนบรรทัด · '+title} min={1} max={10} value={f.lines||3} disabled={busy} onChange={e=>fieldPatch(item.name,{lines:Number(e.target.value)})}/></label>}
     </>}
     <button type="button" disabled={busy} onClick={()=>{const next={...d.detail_fields};delete next[item.name];patch({...d,detail_fields:next,...(item.related?{related:{...d.related,[item.key]:{...d.related?.[item.key],title:undefined}}}:{})});}}>คืนค่ารูปแบบช่องนี้</button>
    </div>}
    </div>;
   })}</div><p className="hint">ต้องแสดงอย่างน้อย 1 คอลัมน์ · Related จัดแทรกระหว่างข้อมูลได้ · มือถือแสดงเต็มแถว</p>
  </>}
 </div>;
}
