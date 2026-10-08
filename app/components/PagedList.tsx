"use client";
import Icon from "./Icon";
import RecordLabel from "./RecordLabel";
import SearchSelect from "@/app/components/SearchSelect";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppLoading from "./AppLoading";
import type {Column} from "@/lib/columns";
export type ListItem = {id:number;key:string;business_key?:string|null;label:string;image?:string|null;values?:Record<string,any>;errors?:Record<string,string>;permissions?:{update:boolean;delete:boolean};allowedActions?:string[]};
type Page = {rows:ListItem[];total:number;page:number;pages:number;limit:number;columns?:Column[];source_columns?:Column[]};
export default function PagedList({title,table,query="",limit:initialLimit=5,values,selectValues,onSelect,onOpen,disabled=false,email="",renderRows,refreshRevision=0,onAdd}: {
  onAdd?:()=>void;refreshRevision?:number; title:string; table?:string; query?:string; limit?:number; values?:string[]; selectValues?:string[];
  onSelect?:(values:string[])=>void; onOpen?:(table:string,id:number)=>void; disabled?:boolean; email?:string;
  renderRows?:(rows:ListItem[],cols:Column[],sourceCols:Column[])=>React.ReactNode;
}) {
  const [limit,setLimit]=useState(initialLimit),[page,setPage]=useState(1),[result,setResult]=useState<Page|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const keys = values === undefined ? "" : JSON.stringify(values);
  useEffect(()=>{setPage(1);},[table,query,keys]);
  useEffect(()=>{
    const abort=new AbortController();setLoading(true);setError("");
    (async()=>{
      if (!table) {
        const items: string[] = keys ? JSON.parse(keys) : [], pages=limit ? Math.max(1,Math.ceil(items.length/limit)) : 1, current=Math.min(page,pages);
        setResult({rows:(limit?items.slice((current-1)*limit,current*limit):items).map((label,i)=>({id:(current-1)*limit+i,key:label,label})),total:items.length,page:current,pages,limit});return;
      }
      const url=`/api/lists/${table}?${query}&page=${page}&limit=${limit}`;
      const response=await fetch(url,{signal:abort.signal,headers:{"Content-Type":"application/json","x-nocode-preview-email":email},...(values !== undefined ? {method:"POST",body:JSON.stringify({keys:JSON.parse(keys)})} : {})}),data=await response.json();
      if(!response.ok)throw Error(data.error);if(!abort.signal.aborted)setResult(data);
    })().catch(e=>{if(!abort.signal.aborted)setError(e.message||"โหลดรายการไม่ได้ กรุณาลองใหม่");}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[table,query,keys,limit,page,email,retry,refreshRevision]);
  return <section className="paged-list" aria-label={title}>
    <div className="paged-list-heading"><h3>{title}</h3><label>ต่อหน้า<SearchSelect aria-label={`จำนวนรายการต่อหน้า ${title}`} value={limit} disabled={disabled} onChange={e=>{setLimit(Number(e.target.value));setPage(1);}}>{[5,10,20,0].map(n=><option value={n} key={n}>{n||"ทั้งหมด"}</option>)}</SearchSelect></label></div>
    {onSelect && <p className="hint">เลือกแล้ว {selectValues?.length||0} รายการ{ !!selectValues?.length && <button type="button" disabled={disabled} onClick={()=>onSelect([])}>ยกเลิกทั้งหมด</button>}</p>}
    {loading && !result ? <AppLoading compact/> : error ? <div className="error-banner" role="alert">{error}<button type="button" onClick={()=>setRetry(n=>n+1)}>โหลดรายการอีกครั้ง</button></div> : <>
      {!result?.total && <p className="hint">ไม่มีรายการที่เกี่ยวข้อง</p>}
      {renderRows && result ? renderRows(result.rows,result.columns||[],result.source_columns||[]) : <ul>{result?.rows.map(item=><li key={table?item.id:item.key}>{onSelect ? <label><input type="checkbox" disabled={disabled} checked={selectValues?.includes(item.key)||false} onChange={e=>onSelect(e.target.checked?[...(selectValues||[]),item.key]:(selectValues||[]).filter(v=>v!==item.key))}/><RecordLabel text={item.label} image={item.image}/>{item.business_key && item.business_key!==item.label && <small className="hint" aria-hidden="true"> · {item.business_key}</small>}</label> : table ? onOpen ? <button type="button" className="record-link" onClick={()=>onOpen(table,item.id)}>{item.label} ↗</button> : <Link href={`/t/${table}?row=${item.id}`}>{item.label} ↗</Link> : <span>{item.label}</span>}{!onSelect && item.business_key && item.business_key!==item.label && <small className="hint" aria-hidden="true"> · {item.business_key}</small>}</li>)}</ul>}
      {(!!result?.total||onAdd) && result && <div className="list-pagination"><span>{result.total} รายการ · หน้า {result.page}/{result.pages}</span><div><button type="button" className="pagination-icon-button" aria-label="ก่อนหน้า" title="ก่อนหน้า" disabled={disabled||loading||result.page<=1} onClick={()=>setPage(result.page-1)}><Icon name="chevron" width="16" height="16" style={{transform:"rotate(180deg)"}}/></button><button type="button" className="pagination-icon-button" aria-label="ถัดไป" title="ถัดไป" disabled={disabled||loading||result.page>=result.pages} onClick={()=>setPage(result.page+1)}><Icon name="chevron" width="16" height="16"/></button>{onAdd&&<button type="button" className="primary" disabled={disabled||loading} onClick={onAdd}>เพิ่ม</button>}</div></div>}
      {values && table && result && result.total < new Set(values).size && <p className="err">มีรหัสที่ไม่พบในตารางอ้างอิง กรุณาตรวจสูตรหรือรายการที่เลือก</p>}
    </>}
  </section>;
}
