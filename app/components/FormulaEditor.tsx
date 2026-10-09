"use client";
import {forwardRef,useLayoutEffect,useMemo,useRef,type TextareaHTMLAttributes} from "react";
import {highlightFormula} from "@/lib/formula-highlight";
type Props=Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'defaultValue'> & {value:string;compact?:boolean};
const FormulaEditor=forwardRef<HTMLTextAreaElement,Props>(function FormulaEditor({value,rows=4,className='',compact=false,onScroll,...props},forwardedRef){
 const input=useRef<HTMLTextAreaElement|null>(null),paint=useRef<HTMLPreElement>(null),gutter=useRef<HTMLDivElement>(null);
 const tokens=useMemo(()=>highlightFormula(value),[value]);
 const sync=()=>{const el=input.current;if(!el)return;if(paint.current){paint.current.style.width=el.clientWidth+"px";paint.current.style.height=el.clientHeight+"px";paint.current.scrollTop=el.scrollTop;paint.current.scrollLeft=el.scrollLeft;}if(gutter.current)gutter.current.style.transform='translateY(-'+el.scrollTop+'px)';};
 useLayoutEffect(sync,[value]);
 useLayoutEffect(()=>{if(!input.current)return;const observer=new ResizeObserver(sync);observer.observe(input.current);return()=>observer.disconnect();},[]);
 return <div className={'formula-code-editor '+(compact?'formula-code-compact ':'')+(props.disabled?'formula-code-disabled ':'')}>
  <div className="formula-code-gutter" aria-hidden="true"><div ref={gutter}>{value.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div></div>
  <div className="formula-code-content">
   <pre ref={paint} className="formula-code-paint" aria-hidden="true">{tokens.map((token,i)=><span key={i} className={'formula-token-'+token.kind}>{token.text}</span>)}{'\n'}</pre>
   <textarea {...props} ref={el=>{input.current=el;if(typeof forwardedRef==='function')forwardedRef(el);else if(forwardedRef)forwardedRef.current=el;}} className={'formula-code-textarea '+className} rows={rows} value={value} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" onScroll={e=>{sync();onScroll?.(e);}}/>
  </div>
 </div>;
});
export default FormulaEditor;
