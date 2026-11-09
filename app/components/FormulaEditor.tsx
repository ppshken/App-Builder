"use client";
import {forwardRef,useLayoutEffect,useMemo,useRef,useState,useEffect,useId,type TextareaHTMLAttributes} from "react";
import {highlightFormula} from "@/lib/formula-highlight";
import {editFormula} from "@/lib/formula-editing";
import {formulaCompletions,type FormulaTable,type Completion} from "@/lib/formula-completion";
import type {Column} from "@/lib/columns";
type Props=Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'defaultValue'> & {value:string;localOnly?:boolean;rowRule?:boolean;compact?:boolean;columns?:Column[];tables?:FormulaTable[]};
const FormulaEditor=forwardRef<HTMLTextAreaElement,Props>(function FormulaEditor({value,rows:_rows,className='',compact=false,localOnly=false,rowRule=false,onScroll,onKeyDown,columns=[],tables=[],onChange,onFocus,onBlur,onSelect,...props},forwardedRef){
 const input=useRef<HTMLTextAreaElement|null>(null),paint=useRef<HTMLPreElement>(null),gutter=useRef<HTMLDivElement>(null);
 const [schema,setSchema]=useState<FormulaTable[]>([]),[focused,setFocused]=useState(false),[caret,setCaret]=useState(0),[dismissed,setDismissed]=useState(false),[active,setActive]=useState(0),[popup,setPopup]=useState({left:0,top:0});const listId=useId(),loading=useRef(false),optionsRef=useRef<HTMLDivElement>(null);
 const completion=useMemo(()=>{const result=formulaCompletions(value,caret,columns,rowRule||localOnly?[]:tables.length?tables:schema);if(localOnly){const names=new Set(["id","_THIS","_THISROW",...columns.map(c=>c.name)]);return {...result,items:result.items.filter(item=>item.kind==='Table'?false:item.kind==='Function'?!['SELECT()','LOOKUP()','FILTER()','REF_ROWS()'].includes(item.label):item.kind==='Value'?true:names.has(item.label))};}if(!rowRule)return result;const names=new Set(['id',...columns.map(c=>c.name)]);return {...result,items:result.items.filter(item=>item.kind==='Function'?!['SELECT()','USERSETTINGS()','LOOKUP()','FILTER()','REF_ROWS()'].includes(item.label):item.kind==='Table'?false:item.kind==='Value'?['TRUE','FALSE','NULL'].includes(item.label):names.has(item.label))};},[value,caret,columns,tables,schema,rowRule,localOnly]);
 const visible=focused&&!dismissed&&!props.disabled&&!props.readOnly&&completion.items.length>0;
 const updateCaret=(el:HTMLTextAreaElement)=>{setCaret(el.selectionStart);setActive(0);setDismissed(false);};
 const commit=(next:string,start:number,end=start)=>{const el=input.current;if(!el)return;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")?.set?.call(el,next);el.dispatchEvent(new Event("input",{bubbles:true}));el.setSelectionRange(start,end);setCaret(start);requestAnimationFrame(()=>{if(input.current===el){el.setSelectionRange(start,end);sync();}});};
 const accept=(item:Completion)=>{const next=value.slice(0,completion.start)+item.insert+value.slice(caret);commit(next,completion.start+item.insert.length-(item.cursorBack||0));setDismissed(true);};
 useLayoutEffect(()=>{const el=input.current;if(!el||!visible)return;const style=getComputedStyle(el),line=value.slice(0,caret).split('\n');const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(ctx)ctx.font=style.font;const width=ctx?.measureText(line[line.length-1].replace(/\t/g,'  ')).width||0;setPopup({left:Math.max(0,Math.min(el.clientWidth-250,parseFloat(style.paddingLeft)+width-el.scrollLeft)),top:Math.max(0,parseFloat(style.paddingTop)+line.length*parseFloat(style.lineHeight)-el.scrollTop)});},[value,caret,visible]);
 useEffect(()=>{optionsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});},[active]);
 const tokens=useMemo(()=>highlightFormula(value,focused?caret:undefined),[value,caret,focused]);
 const sync=()=>{const el=input.current;if(!el)return;if(paint.current){paint.current.style.width=el.clientWidth+"px";paint.current.style.height=el.clientHeight+"px";paint.current.scrollTop=el.scrollTop;paint.current.scrollLeft=el.scrollLeft;}if(gutter.current)gutter.current.style.transform='translateY(-'+el.scrollTop+'px)';};
 useLayoutEffect(sync,[value]);
 useLayoutEffect(()=>{if(!input.current)return;const observer=new ResizeObserver(sync);observer.observe(input.current);return()=>observer.disconnect();},[]);
 return <div className={'formula-code-editor '+(compact?'formula-code-compact ':'')+(props.disabled?'formula-code-disabled ':'')}>
  <div className="formula-code-gutter" aria-hidden="true"><div ref={gutter}>{value.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div></div>
  <div className="formula-code-content">
   {visible&&<div className="formula-completion" style={popup} onMouseDown={e=>e.preventDefault()}><div ref={optionsRef} id={listId} role="listbox" aria-label="รายการแนะนำสูตร" className="formula-completion-options">{completion.items.map((item,i)=><button type="button" role="option" id={listId+'-'+i} aria-selected={active===i} key={item.kind+item.label} onClick={()=>accept(item)}><span className={'formula-completion-icon kind-'+item.kind.toLowerCase()}>{item.kind==='Function'?'ƒ':item.kind==='Table'?'▤':'['}</span><span><strong>{item.label}</strong>{active===i&&item.description&&<small>{item.description}</small>}</span><em>{item.kind}</em></button>)}</div><footer>Enter เพื่อเติมคำ · ↑ ↓ เลือก · Esc ปิด</footer></div>}
   <pre ref={paint} className="formula-code-paint" aria-hidden="true">{tokens.map((token,i)=><span key={i} className={'formula-token-'+token.kind+(token.matched?' formula-bracket-match':'')}>{token.text}</span>)}{'\n'}</pre>
   <textarea {...props} aria-autocomplete="list" aria-controls={visible?listId:undefined} aria-activedescendant={visible?listId+'-'+active:undefined} onChange={e=>{updateCaret(e.currentTarget);onChange?.(e);}} onSelect={e=>{setCaret(e.currentTarget.selectionStart);onSelect?.(e);}} onFocus={e=>{setFocused(true);updateCaret(e.currentTarget);onFocus?.(e);if(!rowRule&&!localOnly&&!tables.length&&!loading.current){loading.current=true;fetch('/api/tables').then(r=>r.ok?r.json():[]).then(data=>{if(Array.isArray(data))setSchema(data);}).catch(()=>{});}}} onBlur={e=>{setFocused(false);onBlur?.(e);}} ref={el=>{input.current=el;if(typeof forwardedRef==='function')forwardedRef(el);else if(forwardedRef)forwardedRef.current=el;}} className={'formula-code-textarea '+className} rows={Math.max(1,value.split("\n").length)} value={value} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" onKeyDown={e=>{
    onKeyDown?.(e);
    if(e.defaultPrevented||e.nativeEvent.isComposing||props.disabled||props.readOnly||e.ctrlKey||e.metaKey||e.altKey)return;
    if(visible){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+completion.items.length)%completion.items.length);return;}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();accept(completion.items[active]||completion.items[0]);return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDismissed(true);return;}}
    const el=e.currentTarget,edit=editFormula(el.value,el.selectionStart,el.selectionEnd,e.key,e.shiftKey);
    if(!edit)return;e.preventDefault();
    commit(edit.value,edit.start,edit.end);setDismissed(true);
   }} onScroll={e=>{sync();setDismissed(true);onScroll?.(e);}}/>
  </div>
 </div>;
});
export default FormulaEditor;
