"use client";
import type {Column} from '@/lib/columns';
import {AUTO_NUMBER_DEFAULTS,autoNumberText,normalizeAutoNumber,type AutoNumberConfig} from '@/lib/auto-number';

export default function AutoNumberSettings({column,onChange,busy,prefix}:{column:Column;onChange:(patch:Partial<Column>)=>void;busy:boolean;prefix:string}){
 const config=column.auto_number;let error='',example='';
 try{const normalized=normalizeAutoNumber(config,column);if(normalized)example=autoNumberText(normalized,normalized.start);}catch(e){error=(e as Error).message;}
 const patch=(value:Partial<AutoNumberConfig>)=>onChange({auto_number:{...AUTO_NUMBER_DEFAULTS,...config,...value}});
 return <section className="settings-section auto-number-settings" aria-label="ตั้งค่าเลขรันอัตโนมัติ">
  <label className="toggle-setting"><span>เลขรันอัตโนมัติ<small>ระบบสร้างเลขไม่ซ้ำตอนบันทึก และคงเลขเดิมเมื่อแก้ไขรายการ</small></span><input className="switch" type="checkbox" aria-label="เลขรันอัตโนมัติ" disabled={busy} checked={!!config} onChange={e=>onChange(e.target.checked?{auto_number:{...AUTO_NUMBER_DEFAULTS},is_editable:false,is_unique:true,default_expr:'',reset_on_edit:false,reset_columns:[],scan_enabled:false,editable_if:''}:{auto_number:null,is_editable:true})}/></label>
  {config&&<>
   {(['prefix','suffix'] as const).map(key=><div className="field" key={key}><label htmlFor={prefix+'-auto-'+key}>{key==='prefix'?'ข้อความนำหน้า':'ข้อความต่อท้าย'}</label><input id={prefix+'-auto-'+key} disabled={busy} maxLength={40} value={config[key]} placeholder={key==='prefix'?'เช่น DOC-':'ไม่จำเป็น'} onChange={e=>patch({[key]:e.target.value})}/></div>)}
   <div className="designer-control-pair"><label htmlFor={prefix+'-auto-digits'}>จำนวนหลักขั้นต่ำ<input id={prefix+'-auto-digits'} type="number" min={1} max={16} step={1} disabled={busy} value={Number.isFinite(config.digits)?config.digits:''} onChange={e=>patch({digits:e.target.value===''?NaN:Number(e.target.value)})}/></label><label htmlFor={prefix+'-auto-start'}>เลขเริ่มต้น<input id={prefix+'-auto-start'} type="number" min={1} max={Number.MAX_SAFE_INTEGER-1} step={1} disabled={busy} value={Number.isFinite(config.start)?config.start:''} onChange={e=>patch({start:e.target.value===''?NaN:Number(e.target.value)})}/></label></div>
   {error?<p className="err" role="status">{error}</p>:<p className="hint">ตัวอย่างรูปแบบ: <strong>{example}</strong></p>}
   <p className="hint">ตัวอย่างไม่ใช่เลขที่จองไว้ · นับแยกตามตารางและคอลัมน์ ไม่เริ่มนับใหม่เมื่อลบข้อมูลหรือเปลี่ยนข้อความนำหน้า · จำนวนหลักจะเพิ่มได้โดยไม่ตัดเลข · ไม่เติมย้อนหลังให้ข้อมูลเดิม</p>
  </>}
 </section>;
}
