"use client";
import {useState} from 'react';
import type {Column} from '@/lib/columns';
import {parseExpression} from '@/lib/expression';
import {relatedPartDraft} from '@/lib/related-part-settings';
import EditorDialog from './EditorDialog';
import FormulaEditor from './FormulaEditor';
import ExpressionAssistant from './ExpressionAssistant';
import Icon from './Icon';

type Table={name:string;label:string;columns:Column[]};
const fields=[['part_valid_if','รายการลูกต้องผ่านเงื่อนไข (Valid_If)','COUNT([_THIS]) = 7'],['part_show_if','แสดงส่วนรายการลูกเมื่อ','[status] = "เปิด"'],['part_add_if','อนุญาตให้เพิ่มรายการลูกเมื่อ','[status] <> "ปิด"']] as const;
type Field=typeof fields[number][0];
export default function RelatedPartSettings({parent,child,column,tables,onClose,onSaved}:{parent:Table;child:Table;column:Column;tables:Table[];onClose:()=>void;onSaved:()=>Promise<void>}){
 const [draft,setDraft]=useState(()=>relatedPartDraft(column)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[assistant,setAssistant]=useState<Field|null>(null);
 const errors=Object.fromEntries(fields.map(([field])=>{try{if(draft[field]?.trim())parseExpression(draft[field]!);return [field,''];}catch(e){return [field,(e as Error).message];}}));
 async function save(){setBusy(true);setError('');try{const response=await fetch('/api/tables/'+child.name,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'edit_column',name:column.name,...draft,related_required:false})}),result=await response.json();if(!response.ok)throw Error(result.error);await onSaved();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><EditorDialog title={'ตั้งค่ารายการลูก · '+child.label} busy={busy} onClose={onClose} footer={<><button type="button" disabled={busy} onClick={onClose}>ยกเลิก</button><button type="button" className="primary" disabled={busy||Object.values(errors).some(Boolean)} onClick={save}><Icon name="check"/>บันทึก</button></>}>
 <p className="hint">{child.label} [{column.name}] → {parent.label} · สูตรใช้คอลัมน์ของตารางแม่</p>
 <label className="toggle-setting"><span>Is a part of · เป็นส่วนหนึ่งของตารางแม่<small>เพิ่ม/แก้ไขรายการลูกในฟอร์มแม่และบันทึกพร้อมกัน · ยกเลิกแล้วไม่เหลือรายการลูกค้าง · ลบแม่จะลบลูกด้วยโดยตรวจสิทธิ์ทุกแถว</small></span><input className="switch" aria-label="Is a part of" type="checkbox" disabled={busy} checked={!!draft.is_part_of} onChange={e=>setDraft({...draft,is_part_of:e.target.checked})}/></label>
 {!!column.related_required&&<p className="hint">ย้ายการบังคับเดิม “อย่างน้อย 1 รายการ” มาไว้ใน Valid_If แล้ว เปิด Is a part of เพื่อใช้เงื่อนไขนี้ หรือบันทึกขณะปิดเพื่อยกเลิกการบังคับเดิม</p>}
 {fields.map(([field,label,example])=><div className="field" key={field}><label htmlFor={'related-'+field}>{label}</label><div className="formula-input"><FormulaEditor id={'related-'+field} compact columns={parent.columns} tables={tables} disabled={busy||!draft.is_part_of} value={draft[field]||''} placeholder={example} aria-invalid={!!errors[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/><button type="button" className="formula-trigger" aria-label={'เขียนสูตร '+label} disabled={busy||!draft.is_part_of} onClick={()=>setAssistant(field)}>ƒ</button></div>{errors[field]&&<p className="err" role="status">{errors[field]}</p>}{field==='part_valid_if'&&<div className="field"><label htmlFor="related-part-invalid-value-error">Invalid value error</label><textarea id="related-part-invalid-value-error" rows={2} maxLength={1000} disabled={busy||!draft.is_part_of} value={draft.part_invalid_value_error||''} placeholder="ข้อความแจ้งเตือนเมื่อรายการลูกไม่ผ่าน Valid_If" onChange={e=>setDraft({...draft,part_invalid_value_error:e.target.value})}/><small className="hint">เว้นว่างเพื่อใช้ข้อความแจ้งเตือนเริ่มต้น</small></div>}</div>)}
 <p className="hint">[_THIS] ใน Valid_If คือรายการลูกทั้งหมด เช่น COUNT([_THIS]) = 7 ต้องมีครบ 7 รายการก่อนบันทึก · เว้นว่างเพื่อไม่จำกัด</p>{error&&<p className="err" role="alert">{error}</p>}
 </EditorDialog>{assistant&&<ExpressionAssistant column={{name:'part_condition',label:'เงื่อนไขรายการลูก',type:'yesno',show_if:draft[assistant]||''}} columns={parent.columns} tables={tables} field="show_if" childListContext contextLabel={'เงื่อนไขรายการลูก · ตารางแม่ '+parent.label} onClose={()=>setAssistant(null)} onApply={value=>{setDraft({...draft,[assistant]:value});setAssistant(null);}}/>}</>;
}
