export const CUSTOM_ELEMENTS=[['column','Column','จัดเรียงแนวตั้ง'],['row','Row','จัดเรียงแนวนอน'],['container','Container','กล่องเนื้อหา'],['text','ข้อความ','ข้อความและหัวข้อ'],['image','รูปภาพ','รูปจาก URL'],['button','ปุ่ม','เปิด View'],['divider','เส้นแบ่ง','แบ่งส่วนเนื้อหา'],['spacer','ช่องว่าง','เว้นระยะ']] as const;
export type CustomElement=typeof CUSTOM_ELEMENTS[number][0];
export type CustomNode={id:string;type:CustomElement;text?:string;src?:string;alt?:string;view?:string;children?:CustomNode[];padding?:number;gap?:number;radius?:number;fontSize?:number;bold?:boolean;color?:string;background?:string;align?:'left'|'center'|'right';height?:number;stackMobile?:boolean};
export type CustomPageLayout={version:1;children:CustomNode[];background?:string;padding?:number;gap?:number;maxWidth?:number};
export const emptyCustomPage=():CustomPageLayout=>({version:1,children:[],padding:20,gap:16,maxWidth:1200});
export const isCustomContainer=(type:string)=>['column','row','container'].includes(type);
export function safeCustomImage(src:string){if(!src)return true;if(src.startsWith('/')&&!src.startsWith('//')&&!/[\\\s]/.test(src))return true;try{const url=new URL(src);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}}
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function error():never{throw Error('องค์ประกอบหน้ากำหนดเองไม่ถูกต้อง หรือเกินขอบเขตที่กำหนด');};
export function validateCustomPage(value:unknown):CustomPageLayout{
 if(!plain(value)||JSON.stringify(value).length>80000||value.version!==1||!Array.isArray(value.children)||Object.keys(value).some(k=>!['version','children','background','padding','gap','maxWidth'].includes(k)))return error();
 const numeric=(o:Record<string,unknown>,k:string,min:number,max:number)=>{if(o[k]!==undefined&&(typeof o[k]!=='number'||!Number.isInteger(o[k])||(o[k] as number)<min||(o[k] as number)>max))error();};
 const color=(o:Record<string,unknown>,k:string)=>{if(o[k]!==undefined&&(typeof o[k]!=='string'||o[k]!==''&&!/^#[a-f0-9]{6}$/i.test(o[k] as string)))error();};
 numeric(value,'padding',0,80);numeric(value,'gap',0,80);numeric(value,'maxWidth',280,1800);color(value,'background');
 const ids=new Set<string>();let count=0;
 function walk(nodes:unknown[],depth:number){if(depth>8)error();for(const node of nodes){if(!plain(node)||++count>100||typeof node.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(node.id)||ids.has(node.id)||!CUSTOM_ELEMENTS.some(([t])=>t===node.type)||Object.keys(node).some(k=>!['id','type','text','src','alt','view','children','padding','gap','radius','fontSize','bold','color','background','align','height','stackMobile'].includes(k)))error();ids.add(node.id as string);
 for(const [key,max] of [['text',4000],['src',2000],['alt',300],['view',41]] as const)if(node[key]!==undefined&&(typeof node[key]!=='string'||(node[key] as string).length>max))error();
 if(node.src&&!safeCustomImage(node.src as string))error();if(node.view&&(node.type!=='button'||!/^[a-z][a-z0-9_]{0,40}$/.test(node.view as string)))error();
 for(const [key,min,max] of [['padding',0,80],['gap',0,80],['radius',0,80],['fontSize',10,72],['height',0,800]] as const)numeric(node,key,min,max);
 color(node,'color');color(node,'background');if(node.align!==undefined&&!['left','center','right'].includes(node.align as string))error();for(const key of ['bold','stackMobile'])if(node[key]!==undefined&&typeof node[key]!=='boolean')error();
 if(node.children!==undefined){if(!isCustomContainer(node.type as string)||!Array.isArray(node.children))error();walk(node.children as unknown[],depth+1);}}
 }walk(value.children,1);return value as CustomPageLayout;
}
export function customNodes(nodes:CustomNode[]):CustomNode[]{return nodes.flatMap(n=>[n,...customNodes(n.children||[])]);}
export function customTargets(layout?:CustomPageLayout){return [...new Set(customNodes(layout?.children||[]).map(n=>n.type==='button'?n.view:'').filter((n):n is string=>!!n))];}
export function updateCustomNode(layout:CustomPageLayout,id:string,patch:Partial<CustomNode>):CustomPageLayout{const map=(nodes:CustomNode[]):CustomNode[]=>nodes.map(n=>n.id===id?{...n,...patch,id:n.id,type:n.type}:{...n,...(n.children?{children:map(n.children)}:{})});return {...layout,children:map(layout.children)};}
export function removeCustomNode(layout:CustomPageLayout,id:string):CustomPageLayout{const map=(nodes:CustomNode[]):CustomNode[]=>nodes.filter(n=>n.id!==id).map(n=>({...n,...(n.children?{children:map(n.children)}:{})}));return {...layout,children:map(layout.children)};}
export function insertCustomNode(layout:CustomPageLayout,node:CustomNode,parent='',index?:number):CustomPageLayout{
 if(parent&&!customNodes(layout.children).some(n=>n.id===parent&&isCustomContainer(n.type)))throw Error('เลือกกล่องปลายทางก่อน');
 const insert=(nodes:CustomNode[])=>{const next=[...nodes];next.splice(index===undefined?next.length:Math.max(0,Math.min(next.length,index)),0,node);return next;};
 const result=parent?updateCustomNode(layout,parent,{children:insert(customNodes(layout.children).find(n=>n.id===parent)?.children||[])}):{...layout,children:insert(layout.children)};return validateCustomPage(result);
}
export function moveCustomNode(layout:CustomPageLayout,id:string,parent='',index?:number):CustomPageLayout{
 const node=customNodes(layout.children).find(n=>n.id===id);if(!node)throw Error('ไม่พบองค์ประกอบ');if(parent===id||customNodes(node.children||[]).some(n=>n.id===parent))throw Error('ย้ายกล่องเข้าไปในตัวเองไม่ได้');return insertCustomNode(removeCustomNode(layout,id),node,parent,index);
}
export function customParent(nodes:CustomNode[],id:string,parent=''): {parent:string;index:number}|undefined{for(let i=0;i<nodes.length;i++){if(nodes[i].id===id)return {parent,index:i};const found=customParent(nodes[i].children||[],id,nodes[i].id);if(found)return found;}}
