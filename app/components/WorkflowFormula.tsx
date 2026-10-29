"use client";
import {useState} from 'react';
import type {Column} from '@/lib/columns';
import {formatFormula,references} from '@/lib/expression';
import ExpressionAssistant from './ExpressionAssistant';
import Icon from './Icon';

export default function WorkflowFormula({label,value,onChange,columns,tables=[],resultType='any'}:{
 label:string;value:string;onChange:(source:string)=>void;columns:Column[];
 tables?:{name:string;label:string;columns?:Column[]}[];resultType?:'any'|'boolean'|'text';
}){
 const [open,setOpen]=useState(false),[formatError,setFormatError]=useState('');
 let error='';
 try{for(const name of references(value))if(name!=='id'&&!columns.some(c=>c.name===name))error='ไม่พบคอลัมน์ ['+name+']';}catch(e){error=(e as Error).message;}
 const field=resultType==='boolean'?'show_if':'default_expr';
 return <div className="field workflow-formula-field">
  <div className="workflow-formula-heading"><span className="field-label">{label}</span><button type="button" className="icon-button" title="จัดรูปแบบสูตร" aria-label={'จัดรูปแบบสูตร '+label} onClick={()=>{try{onChange(formatFormula(value));setFormatError('');}catch(e){setFormatError((e as Error).message);}}}><Icon name="code"/></button></div>
  <button type="button" className="workflow-formula-input" aria-label={'แก้ไขสูตร '+label} aria-haspopup="dialog" aria-invalid={!!error} onClick={()=>setOpen(true)}>
   <span className="workflow-formula-symbol" aria-hidden="true">ƒ</span><code>{value||'กดเพื่อใส่สูตร'}</code><Icon name="expand" width="16" height="16"/>
  </button>
  {(error||formatError)&&<small className="err" role="alert">{error||formatError}</small>}
  {open&&<ExpressionAssistant column={{name:'workflow_expression',label,type:resultType==='boolean'?'yesno':'text',[field]:value}} columns={columns} tables={tables} field={field} resultType={resultType==='any'?'any':'column'} contextLabel={label} onApply={source=>{onChange(source);setFormatError('');setOpen(false);}} onClose={()=>setOpen(false)}/>}
 </div>;
}
