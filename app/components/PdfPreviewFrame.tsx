"use client";
import './pdf-preview-frame.css';
import {useEffect,useRef,useState} from 'react';

// Screen-only scaling. The original report HTML and print dimensions stay unchanged.
export default function PdfPreviewFrame({html,title,className,orientation,designed}:{html:string;title:string;className?:string;orientation:string;designed:boolean}){
 const frame=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
 useEffect(()=>{const el=frame.current;if(!el)return;const measure=()=>{const width=el.clientWidth,height=el.clientHeight;if(width>0&&height>0)setSize(old=>old.width===width&&old.height===height?old:{width,height});};measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const dimensions=/class="designed-page" style="position:relative;width:([0-9.]+)mm;height:([0-9.]+)mm/.exec(html),marginMatch=/@page\s*\{[^}]*\bmargin:\s*([0-9.]+)mm\b/i.exec(html),margin=marginMatch?Number(marginMatch[1]):16,contentWidth=dimensions?Number(dimensions[1]):orientation==='landscape'?265:178,contentHeight=dimensions?Number(dimensions[2]):orientation==='landscape'?178:265,width=contentWidth+2*margin,height=contentHeight+2*margin,scale=Math.max(.01,Math.min(2,(size.width-48)/(width*96/25.4),(size.height-32)/(height*96/25.4)));
 // @page margins do not appear on screen. Wrap the unchanged content area in
 // a screen-only paper sheet, retaining its original absolute coordinates.
 const screenStyle='<style data-pdf-preview-display>@media screen{html{background:#eef2f6;padding:16px;overflow-x:hidden;scrollbar-gutter:stable}body{width:'+width+'mm;max-width:none;zoom:'+scale+';margin:0 auto!important;background:transparent}.pdf-preview-paper{box-sizing:border-box;width:'+width+'mm;height:'+height+'mm;padding:'+margin+'mm;background:#fff;box-shadow:0 2px 8px #0002;margin:0 0 '+20/scale+'px}.pdf-preview-paper:last-of-type{margin-bottom:0}.designed-page{background:#fff;margin:0;box-shadow:none}}</style>';
 const paperHtml=designed?html.replace(/(<section class="designed-page"[^>]*>)([\s\S]*?<\/section>)/g,'<div class="pdf-preview-paper">$1$2</div>'):html;
 const source=designed?size.width?paperHtml.replace(/<\/head>/i,screenStyle+'</head>'): '':html;
 let issues:string[]=[];let count=0;
 try{const messages=/<meta name="pdf-overflow-messages" content="([^"]*)">/.exec(html),total=/<meta name="pdf-overflow-count" content="([0-9]+)">/.exec(html);const parsed=messages?JSON.parse(decodeURIComponent(messages[1])):[];if(Array.isArray(parsed))issues=parsed.filter((v):v is string=>typeof v==='string').slice(0,20);count=total?Number(total[1]):issues.length;}catch{}
 return <div className={'pdf-preview-container '+(className||'')}>{issues.length>0&&<div className="pdf-overflow-notice" role="alert"><strong>พบเนื้อหาล้นช่องตาราง {count} ช่อง · ยังสร้าง PDF ไม่ได้</strong><p>ช่องที่มีปัญหาแสดงกรอบสีแดง กรุณาปรับความสูงแถว ขนาดรูป หรือขนาดตัวอักษร แล้วพรีวิวใหม่</p><details open><summary>ตำแหน่งที่ต้องแก้ไข</summary><ul>{issues.map((message,i)=><li key={i}>{message}</li>)}</ul>{count>issues.length&&<small>แสดง {issues.length} จาก {count} ช่อง</small>}</details></div>}<div ref={frame} className="pdf-preview-frame">{(!designed||size.width>0)&&<iframe key={source} title={title} sandbox="" srcDoc={source}/>}</div></div>;
}
