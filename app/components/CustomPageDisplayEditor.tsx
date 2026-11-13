"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {emptyCustomPage,type CustomPageLayout} from '@/lib/custom-page';
function NumberControl({label,value,min,max,step=1,disabled,onChange}:{label:string;value:number;min:number;max:number;step?:number;disabled:boolean;onChange:(value:number)=>void}){const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);return <input aria-label={label} type="number" min={min} max={max} step={step} disabled={disabled} value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{const number=Number(text);if(text!==''&&Number.isFinite(number)&&number>=min&&number<=max&&(step!==1||Number.isInteger(number)))onChange(number);else setText(String(value));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>;}
export default function CustomPageDisplayEditor({value,busy=false,onChange,onDesign}:{value?:CustomPageLayout;busy?:boolean;onChange:(value:CustomPageLayout)=>void;onDesign:()=>void}){
 const layout=value||emptyCustomPage(),patch=(next:Partial<CustomPageLayout>)=>onChange({...layout,version:2,...next});
 const setting=(title:string,help:string,control:ReactNode)=><div className="designer-setting"><div className="designer-setting-label"><h3>{title}</h3><p>{help}</p></div><div className="designer-setting-control">{control}</div></div>;
 const number=(label:string,key:'padding'|'gap'|'maxWidth'|'radius'|'borderWidth'|'lineHeight',fallback:number,min:number,max:number,step=1)=><NumberControl label={label} value={layout[key]??fallback} min={min} max={max} step={step} disabled={busy} onChange={value=>patch({[key]:value})}/>;
 return <div className="view-display-editor custom-display-settings"><p className="display-intro">ปรับระยะและขอบของหน้าจอทั้งหน้า โดยใช้ค่าเดียวกับตัวออกแบบและ Preview</p>
 {setting('ออกแบบหน้าจอ','จัดวางองค์ประกอบและตั้งค่าข้อมูลแต่ละส่วน',<button type="button" className="primary" disabled={busy} onClick={onDesign}>เปิดตัวออกแบบ</button>)}
 {setting('ระยะขอบข้อมูล','เว้นระยะด้านในจากขอบหน้าจอ 0–80 พิกเซล',number('ระยะขอบหน้ากำหนดเอง','padding',20,0,80))}
 {setting('ระยะห่างขององค์ประกอบ','ระยะระหว่างส่วนหลักของหน้า 0–80 พิกเซล ส่วนที่ซ้อนใน Row/Column ตั้งแยกในตัวออกแบบได้',number('ระยะห่างหน้ากำหนดเอง','gap',16,0,80))}
 {setting('ความกว้างเนื้อหา','เต็มพื้นที่ใช้ความกว้างจอจริง ส่วนจำกัดความกว้างจัดเนื้อหากึ่งกลาง',<select aria-label="ความกว้างเนื้อหาหน้ากำหนดเอง" disabled={busy} value={layout.fullWidth?'full':'bounded'} onChange={e=>patch({fullWidth:e.target.value==='full'})}><option value="full">เต็มพื้นที่หน้าจอ</option><option value="bounded">จำกัดความกว้าง</option></select>)}
 {!layout.fullWidth&&setting('ความกว้างสูงสุด','จัดเนื้อหากึ่งกลางหน้าจอ 280–1800 พิกเซล และย่อตามขนาดจออัตโนมัติ',number('ความกว้างหน้ากำหนดเอง','maxWidth',1200,280,1800))}
 {setting('ระยะห่างระหว่างบรรทัด','ใช้กับข้อความที่ไม่ได้กำหนดรูปแบบแยก 1–3 เท่า',number('ระยะห่างบรรทัดหน้ากำหนดเอง','lineHeight',1.55,1,3,0.05))}
 {setting('รูปแบบเส้นขอบ','เส้นขอบรอบพื้นที่เนื้อหาทั้งหน้า',<select aria-label="เส้นขอบหน้ากำหนดเอง" disabled={busy} value={layout.borderStyle||'none'} onChange={e=>patch({borderStyle:e.target.value as CustomPageLayout['borderStyle']})}><option value="none">ไม่มีเส้นขอบ</option><option value="solid">เส้นทึบ</option><option value="dashed">เส้นประ</option></select>)}
 {layout.borderStyle&&layout.borderStyle!=='none'&&setting('ความหนาเส้นขอบ','0–8 พิกเซล สีเส้นขอบปรับตามธีม',number('ความหนาขอบหน้ากำหนดเอง','borderWidth',1,0,8))}
 {setting('ความโค้งมุม','ปรับมุมของพื้นที่เนื้อหา 0–40 พิกเซล',number('มุมโค้งหน้ากำหนดเอง','radius',0,0,40))}
 {setting('เงา','แสดงเงารอบพื้นที่เนื้อหา',<label className="toggle-setting"><span>แสดงเงา</span><input className="switch" aria-label="เงาหน้ากำหนดเอง" type="checkbox" disabled={busy} checked={!!layout.shadow} onChange={e=>patch({shadow:e.target.checked})}/></label>)}
 {setting('สีพื้นหลัง','เว้นใช้สีตามธีม หรือกำหนดสีเฉพาะหน้าจอนี้',<div className="row"><input aria-label="สีพื้นหลังหน้ากำหนดเอง" type="color" disabled={busy} value={layout.background||'#ffffff'} onChange={e=>patch({background:e.target.value})}/><button type="button" disabled={busy||!layout.background} onClick={()=>patch({background:''})}>ใช้สีตามธีม</button></div>)}
 <button type="button" disabled={busy} onClick={()=>{const next={...layout};for(const key of ['padding','gap','maxWidth','fullWidth','radius','borderStyle','borderWidth','shadow','lineHeight','background'] as const)delete next[key];onChange(next);}}>คืนค่าเริ่มต้นของระยะและขอบ</button>
 </div>;
}
