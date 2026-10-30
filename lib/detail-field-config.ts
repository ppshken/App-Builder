export type DetailFieldDisplay={presentation?:'inherit'|'vertical'|'edges'|'emphasis'|'muted'|'card'|'excerpt';width?:'inherit'|'half'|'full';label?:string;show_label?:boolean;align?:'inherit'|'left'|'center'|'right';hide_empty?:boolean;lines?:number};
export const DETAIL_PRESENTATIONS=[['inherit','ตามค่าของหน้า'],['vertical','ชื่อด้านบน · ค่าด้านล่าง'],['edges','ชื่อซ้าย · ค่าขวา'],['emphasis','ค่าเด่น'],['muted','ค่ารอง'],['card','กล่องข้อมูล'],['excerpt','ข้อความยาวแบบย่อ']] as const;
export function validateDetailFields(value:unknown,cols:{name:string;type:string}[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>400)throw Error('รูปแบบคอลัมน์รายละเอียดไม่ถูกต้อง');
 for(const [name,raw] of Object.entries(value)){
  const related=/^related:[a-z][a-z0-9_]{0,40}:[a-z][a-z0-9_]{0,40}$/.test(name),column=cols.find(c=>c.name===name),f=raw as DetailFieldDisplay;
  if(!related&&!column||!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!(related?['width']:['presentation','width','label','show_label','align','hide_empty','lines']).includes(k)))throw Error('เลือกคอลัมน์รายละเอียดหรือ Related ให้ถูกต้อง');
  if(f.presentation!==undefined&&!DETAIL_PRESENTATIONS.some(([key])=>key===f.presentation)||f.width!==undefined&&!['inherit','half','full'].includes(f.width)||f.align!==undefined&&!['inherit','left','center','right'].includes(f.align))throw Error('รูปแบบการแสดงคอลัมน์ไม่ถูกต้อง');
  if(f.presentation==='excerpt'&&!['text','longtext'].includes(column?.type||''))throw Error('ข้อความแบบย่อใช้กับข้อความเท่านั้น');
  if(f.label!==undefined&&(typeof f.label!=='string'||f.label.length>100)||f.show_label!==undefined&&typeof f.show_label!=='boolean'||f.hide_empty!==undefined&&typeof f.hide_empty!=='boolean'||f.lines!==undefined&&(!Number.isInteger(f.lines)||f.lines<1||f.lines>10))throw Error('ค่าการแสดงคอลัมน์ไม่ถูกต้อง');
 }
}
export function detailEmpty(value:unknown){return value==null||value===''||Array.isArray(value)&&value.length===0;}
