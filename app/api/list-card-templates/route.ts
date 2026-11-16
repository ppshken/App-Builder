import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {withAuth} from '@/lib/auth-api';
import {db,columnsOf} from '@/lib/db';
import {assertTablePermission} from '@/lib/permissions';
import {bad,errorMessage,errorStatus,readBody} from '@/lib/api';
import {validateListCard,validateListCardActions,listCardReferences,remapListCard,type ListCardTemplate} from '@/lib/list-card';
import {customNodes} from '@/lib/custom-page';
export const dynamic='force-dynamic';
function hasLibraryColumn(){return (db.pragma("table_info('_app_settings')") as {name:string}[]).some(c=>c.name==='list_card_templates_json');}
function library():ListCardTemplate[]{if(!hasLibraryColumn())return [];const row=db.prepare('SELECT list_card_templates_json AS json FROM _app_settings WHERE id=1').get() as {json:string};const items=JSON.parse(row?.json||'[]');if(!Array.isArray(items))throw Error('คลังแม่แบบรายการไม่ถูกต้อง');return items;}
function write(items:ListCardTemplate[]){const json=JSON.stringify(items);if(items.length>20||json.length>300000)throw Error('เก็บแม่แบบได้สูงสุด 20 แบบ และขนาดรวมไม่เกิน 300 KB');if(!hasLibraryColumn())db.exec("ALTER TABLE _app_settings ADD COLUMN list_card_templates_json TEXT NOT NULL DEFAULT '[]'");db.prepare('UPDATE _app_settings SET list_card_templates_json=? WHERE id=1').run(json);}
export const GET=withAuth(async()=>{try{return NextResponse.json(library());}catch(e){return bad(errorMessage(e),errorStatus(e));}});
export const POST=withAuth(async(req:Request)=>{try{const b=await readBody(req);if(typeof b.table_name!=='string')throw Error('กรุณาเลือกตาราง');assertTablePermission(b.table_name,'read');const cols=columnsOf(b.table_name);
 if(b.op==='save'){const layout=validateListCard(b.layout,cols);validateListCardActions(layout,db.prepare('SELECT name,table_name FROM _actions').all() as any[],b.table_name);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80)throw Error('ชื่อแม่แบบต้องมี 1–80 ตัวอักษร');return NextResponse.json(db.transaction(()=>{const items=library();if(items.some(t=>t.name.toLowerCase()===b.name.trim().toLowerCase()))throw Error('ชื่อแม่แบบซ้ำ กรุณาตั้งชื่อใหม่');const names=listCardReferences(layout),item:ListCardTemplate={id:randomUUID(),name:b.name.trim(),layout,columns:names.map(name=>{const c=cols.find(c=>c.name===name);return {name,label:c?.label||'รหัสแถว',type:c?.type||'number'};}),created_at:Date.now()};write([...items,item]);return item;})());}
 if(b.op==='apply'){const template=library().find(t=>t.id===b.id);if(!template)throw Error('ไม่พบแม่แบบในแอปนี้');if(!b.mapping||typeof b.mapping!=='object'||Array.isArray(b.mapping))throw Error('กรุณาจับคู่คอลัมน์');const mapping:Record<string,string>={};for(const c of template.columns){const name=b.mapping[c.name];if(typeof name!=='string'||name!=='id'&&!cols.some(col=>col.name===name))throw Error('กรุณาจับคู่คอลัมน์ '+c.label);mapping[c.name]=name;}
 const layout=remapListCard(template.layout,mapping);let cleared=0;for(const n of customNodes(layout.children))if(n.action){delete n.action;cleared++;}validateListCard(layout,cols);return NextResponse.json({layout,warnings:cleared?['กรุณาเลือก Action ของตารางปลายทางใหม่']:[]});}throw Error('คำสั่งแม่แบบไม่ถูกต้อง');
 }catch(e){return bad(errorMessage(e),errorStatus(e));}});
export const DELETE=withAuth(async(req:Request)=>{try{const id=new URL(req.url).searchParams.get('id');db.transaction(()=>{const items=library();if(!items.some(t=>t.id===id))throw Error('ไม่พบแม่แบบ');write(items.filter(t=>t.id!==id));})();return NextResponse.json({ok:true});}catch(e){return bad(errorMessage(e),errorStatus(e));}});
