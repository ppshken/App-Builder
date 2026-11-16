export type PdfOverflow={id:string;page:number;table:string;row:string;column:string;verticalMm:number;horizontalMm:number};
// Self-contained so Chromium can execute this same function for preview and export.
export function collectPdfOverflows():PdfOverflow[]{
 return Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-cell]')).filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2).map(el=>{
 const box=el.getBoundingClientRect(),part=Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-column-part]')).find(n=>n.getBoundingClientRect().bottom>box.bottom+2||n.getBoundingClientRect().right>box.right+2);
 return {id:el.dataset.pdfCell||'',page:Number(el.dataset.pdfPage)||1,table:el.dataset.pdfTable||'ตาราง',row:el.dataset.pdfRow||'—',column:part?.dataset.pdfColumnPart||el.dataset.pdfColumn||'—',verticalMm:Math.max(0,el.scrollHeight-el.clientHeight)*25.4/96,horizontalMm:Math.max(0,el.scrollWidth-el.clientWidth)*25.4/96};
 });
}
export function pdfOverflowMessage(issue:PdfOverflow){return 'หน้า '+issue.page+' · '+issue.table+' · แถว '+issue.row+' · คอลัมน์ '+issue.column+' — '+(issue.verticalMm>0?'สูงเกิน '+issue.verticalMm.toFixed(1)+' มม.':'กว้างเกิน '+issue.horizontalMm.toFixed(1)+' มม.');}
export function annotatePdfOverflow(html:string,issues:PdfOverflow[]){
 if(!issues.length)return html;
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const byId=new Map(issues.map(i=>[i.id,pdfOverflowMessage(i)]));
 const marked=html.replace(/data-pdf-cell="([a-zA-Z0-9_-]+)"/g,(m,id)=>byId.has(id)?m+' data-pdf-overflow="true" title="'+escape(byId.get(id)!)+'"':m);
 const metadata='<meta name="pdf-overflow-messages" content="'+encodeURIComponent(JSON.stringify(issues.slice(0,20).map(pdfOverflowMessage)))+'"><meta name="pdf-overflow-count" content="'+issues.length+'"><style>@media screen{[data-pdf-overflow="true"]{outline:2px solid #dc2626!important;outline-offset:-2px;background:#fef2f2!important}}</style>';
 return marked.replace(/<\/head>/i,metadata+'</head>');
}
