export type DetailTab={id:string;label:string;fields:string[]};
export function validateDetailTabs(value:unknown,columns:{name:string}[]){
 if(!Array.isArray(value)||value.length>12)throw Error('กำหนดแท็บรายละเอียดได้สูงสุด 12 แท็บ');
 const ids=new Set<string>(),fields=new Set<string>();
 for(const t of value){if(!t||typeof t!=='object'||!/^tab_[a-z0-9_]{1,40}$/.test(t.id)||ids.has(t.id)||typeof t.label!=='string'||!t.label.trim()||t.label.length>60||!Array.isArray(t.fields)||t.fields.length>400)throw Error('ชื่อหรือรหัสแท็บรายละเอียดไม่ถูกต้อง');ids.add(t.id);
  for(const field of t.fields){if(typeof field!=='string'||fields.has(field)||!columns.some(c=>c.name===field)&&!/^related:[a-z][a-z0-9_]{0,40}:[a-z][a-z0-9_]{0,40}$/.test(field))throw Error('คอลัมน์ในแท็บไม่ถูกต้อง หรืออยู่มากกว่าหนึ่งแท็บ');fields.add(field);}
 }
}
export function detailTabGroups<T extends {key:string}>(items:T[],tabs:DetailTab[]){
 const assigned=new Set(tabs.flatMap(t=>t.fields)),rest=items.filter(item=>!assigned.has(item.key));
 const groups=tabs.map(tab=>({...tab,items:items.filter(item=>tab.fields.includes(item.key))})).filter(tab=>tab.items.length);
 return [...(rest.length?[{id:'general',label:'ทั่วไป',fields:rest.map(i=>i.key),items:rest}]:[]),...groups];
}
