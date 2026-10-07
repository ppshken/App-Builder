"use client";
import { useEffect, useState } from "react";
export default function ColumnCell({value,label,disabled,onSave,formula=false}:{value:string;label:string;disabled:boolean;onSave:(value:string)=>Promise<boolean>;formula?:boolean}) {
 const [draft,setDraft]=useState(value),[error,setError]=useState(false);
 useEffect(()=>{setDraft(value);setError(false);},[value]);
 return <input aria-label={label} aria-invalid={error} disabled={disabled} className={formula?"column-formula-cell":""} value={draft} placeholder={formula?"ไม่มีสูตร":""} onChange={e=>{setDraft(e.target.value);setError(false);}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape"){e.currentTarget.value=value;setDraft(value);setError(false);e.currentTarget.blur();}}} onBlur={async e=>{const next=e.currentTarget.value;if(next!==value){const ok=await onSave(next);setError(!ok);if(!ok)setDraft(value);}}}/>;
}
export function ColumnToggle({value,label,disabled,onSave}:{value:boolean;label:string;disabled:boolean;onSave:(value:boolean)=>Promise<boolean>}) {
 const [checked,setChecked]=useState(value);
 useEffect(()=>setChecked(value),[value]);
 return <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={async e=>{const next=e.target.checked;setChecked(next);if(!await onSave(next))setChecked(value);}}/>;
}
