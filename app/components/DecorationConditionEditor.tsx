"use client";
import {useId,useState} from 'react';
import type {Column} from '@/lib/columns';
import {validateDataStyles} from '@/lib/data-decoration';
import FormulaEditor from './FormulaEditor';
import ExpressionAssistant from './ExpressionAssistant';
import Icon from './Icon';
export default function DecorationConditionEditor({column,columns,value,busy,label,onChange}:{column:Column;columns:Column[];value:string;busy:boolean;label:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),inputId=useId();
 const validate=(source:string)=>validateDataStyles({[column.name]:{rules:[{condition:source,appearance:{}}]}},columns);
 return <><label htmlFor={inputId}>{'เงื่อนไข'}</label><FormulaEditor id={inputId} columns={columns} localOnly compact rows={2} className="formula-expression" aria-label={label} disabled={busy} maxLength={2000} value={value} onChange={e=>onChange(e.target.value)} spellCheck={false}/><div className="row"><button type="button" disabled={busy} onClick={()=>setOpen(true)}><Icon name="formula"/>ตัวช่วยเขียนสูตรเงื่อนไข</button></div><small className="hint">ใช้ [_THIS] แทนค่าของคอลัมน์นี้ หรือ [ชื่อคอลัมน์] ของแถวเดียวกัน เช่น AND([amount] &gt; 100, ISNOTBLANK([status]))</small>
 {open&&<ExpressionAssistant column={{...column,valid_if:value}} columns={columns} field="valid_if" localOnly validateSource={validate} resultType="any" contextLabel={'เงื่อนไขตกแต่ง · '+column.label+' · ใช้คอลัมน์และสูตรของแถวเดียวกัน'} onClose={()=>setOpen(false)} onApply={source=>{validate(source);onChange(source);setOpen(false);}}/>}</>;
}
