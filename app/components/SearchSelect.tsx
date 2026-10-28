"use client";
import {Children,isValidElement,useEffect,useId,useRef,useState} from "react";
import type {ReactNode,SelectHTMLAttributes} from "react";
import {createPortal} from "react-dom";
import RecordLabel from "./RecordLabel";
import Icon from "./Icon";
type Option={value:string;label:string;disabled:boolean;image?:string};
const text=(node:ReactNode):string=>Children.toArray(node).map(n=>isValidElement<{children?:ReactNode}>(n)?text(n.props.children):String(n??"")).join("");
function optionsOf(children:ReactNode,disabled=false):Option[]{return Children.toArray(children).flatMap(n=>{if(!isValidElement<any>(n))return [];if(n.type==="option")return [{value:String(n.props.value??text(n.props.children)),label:String(n.props.label??text(n.props.children)),disabled:disabled||!!n.props.disabled,image:n.props["data-image"]}];return optionsOf(n.props.children,disabled||!!n.props.disabled);});}
export default function SearchSelect(props:SelectHTMLAttributes<HTMLSelectElement>&{onQueryChange?:(query:string)=>void;onCreate?:()=>void;renderOptionLabel?:(option:{value:string;label:string;image?:string})=>ReactNode}){
 const {onQueryChange,renderOptionLabel,onCreate,children,id,value,defaultValue,disabled,className,style,onChange,onFocus,onBlur,autoFocus,required,name,...rest}=props;
 const uid=useId(),dialogId=uid+"-dialog",listId=uid+"-list",native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [popupLabel,setPopupLabel]=useState("เลือกรายการ");
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[cursor,setCursor]=useState(-1),[local,setLocal]=useState(String(defaultValue??""));
 const options=optionsOf(children),chosen=String(value??local),selected=options.find(o=>o.value===chosen),matches=options.filter(o=>o.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),enabled=matches.filter(o=>!o.disabled);
 useEffect(()=>{if(autoFocus)trigger.current?.focus();},[autoFocus]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 useEffect(()=>{if(!open)return;const el=dialog.current!;el.showModal();el.focus({preventScroll:true});return()=>{el.close();if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};},[open]);
 useEffect(()=>{if(cursor>=0)dialog.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.scrollIntoView({block:"nearest"});},[cursor]);
 const choose=(option:Option)=>{if(option.disabled||disabled)return;setLocal(option.value);if(native.current){native.current.value=option.value;native.current.dispatchEvent(new Event("change",{bubbles:true}));}setOpen(false);};
 const show=()=>{if(disabled)return;setPopupLabel(props["aria-label"]||props.title||trigger.current?.labels?.[0]?.textContent?.trim()||"เลือกรายการ");setQuery("");onQueryChange?.("");setCursor(-1);setOpen(true);};
 return <>
  <button {...(rest as any)} id={id} ref={trigger} type="button" role="combobox" value={chosen} disabled={disabled} className={`search-select-trigger ${className||""}`} style={style} aria-expanded={open} aria-haspopup="dialog" aria-controls={open?dialogId:undefined} aria-required={required||props["aria-required"]} onClick={show} onFocus={onFocus as any} onBlur={onBlur as any} onKeyDown={e=>{if(["ArrowDown","ArrowUp","Enter"," "].includes(e.key)){e.preventDefault();show();}}}>
   {renderOptionLabel?renderOptionLabel(selected||{value:"",label:"เลือกค่า"}):<RecordLabel text={selected?.label||"เลือกค่า"} image={selected?.image}/>}<Icon name="chevron" width="16" height="16"/>
  </button>
  {open&&createPortal(<dialog ref={dialog} tabIndex={-1} id={dialogId} className="search-select-dialog" aria-labelledby={uid+"-title"} onCancel={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setOpen(false);}}} onKeyDown={e=>{e.stopPropagation();if((e.target as HTMLElement).closest("[data-select-create]"))return;if(e.key==="Escape"){e.preventDefault();setOpen(false);return;}if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setCursor(i=>Math.max(0,Math.min(enabled.length-1,i+(e.key==="ArrowDown"?1:-1))));}else if(e.key==="Enter"&&!(e.target instanceof HTMLElement&&e.target.getAttribute("role")==="option")&&(enabled[cursor]||enabled[0])){e.preventDefault();choose(enabled[cursor]||enabled[0]);}}}>
  <select {...rest} ref={native} name={name} value={value} defaultValue={defaultValue} disabled={disabled} onChange={onChange} hidden aria-hidden="true" aria-label={undefined} aria-labelledby={undefined} tabIndex={-1}>{children}</select>
   <header><h2 id={uid+"-title"}>{popupLabel}</h2><button type="button" className="icon-button" aria-label="ปิดรายการตัวเลือก" onClick={()=>setOpen(false)}><Icon name="close"/></button></header>
   <div className="search-select-search"><Icon name="search"/><input type="search" aria-label="ค้นหาตัวเลือก" placeholder="ค้นหารายการ…" value={query} onChange={e=>{setQuery(e.target.value);onQueryChange?.(e.target.value);setCursor(-1);}} aria-controls={listId} aria-activedescendant={enabled[cursor]?uid+"-option-"+options.indexOf(enabled[cursor]):undefined}/></div>
   <div id={listId} role="listbox" aria-label={popupLabel} className="search-select-options">{matches.map((option,i)=><button type="button" role="option" aria-selected={chosen===option.value} disabled={option.disabled} id={uid+"-option-"+options.indexOf(option)} key={i} data-cursor={enabled[cursor]===option} onClick={()=>choose(option)}>{renderOptionLabel?renderOptionLabel(option):<RecordLabel text={option.label} image={option.image}/>}{chosen===option.value&&<Icon name="check" width="18" height="18"/>}</button>)}{!matches.length&&<p role="status">ไม่พบรายการ ลองเปลี่ยนคำค้น</p>}</div>
   <footer>{matches.length} ตัวเลือก{onCreate&&<button type="button" data-select-create disabled={disabled} onClick={()=>{setOpen(false);onCreate();}}><Icon name="plus"/>เพิ่มใหม่</button>}</footer>
  </dialog>,document.body)}
 </>;
}
