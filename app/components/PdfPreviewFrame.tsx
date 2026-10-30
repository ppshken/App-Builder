"use client";
import './pdf-preview-frame.css';
import {useEffect,useRef,useState} from 'react';

// Screen-only scaling. The original report HTML and print dimensions stay unchanged.
export default function PdfPreviewFrame({html,title,className,orientation,designed}:{html:string;title:string;className?:string;orientation:string;designed:boolean}){
 const frame=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
 useEffect(()=>{const el=frame.current;if(!el)return;const measure=()=>{const width=el.clientWidth,height=el.clientHeight;if(width>0&&height>0)setSize(old=>old.width===width&&old.height===height?old:{width,height});};measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const width=orientation==='landscape'?265:178,height=orientation==='landscape'?178:265,scale=Math.max(.01,Math.min(2,(size.width-48)/(width*96/25.4),(size.height-32)/(height*96/25.4)));
 const screenStyle='<style data-pdf-preview-display>@media screen{html{background:#eef2f6;padding:16px;overflow-x:hidden;scrollbar-gutter:stable}body{width:'+width+'mm;max-width:none;zoom:'+scale+';margin:0 auto!important;background:transparent}.designed-page{background:#fff;box-shadow:0 2px 8px #0002;margin:0 0 '+20/scale+'px}.designed-page:last-of-type{margin-bottom:0}}</style>';
 const source=designed?size.width?html.replace(/<\/head>/i,screenStyle+'</head>'): '':html;
 return <div ref={frame} className={'pdf-preview-frame '+(className||'')}>{(!designed||size.width>0)&&<iframe key={source} title={title} sandbox="" srcDoc={source}/>}</div>;
}
