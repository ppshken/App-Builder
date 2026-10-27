import {customNodes,customActions,customExpressions,type CustomPageLayout} from './custom-page';
import {formulaErrors,type Column} from './columns';
import {references} from './expression';
export function validateCustomData(layout:CustomPageLayout|undefined,views:{name:string;table_name?:string|null}[],actions:{name:string}[],schemas:Record<string,Column[]>){
 if(!layout)return;
 for(const source of customExpressions(layout)){if(references(source).length)throw Error('สูตรองค์ประกอบไม่มีแถวปัจจุบัน');const errors=formulaErrors([{name:'custom_value',label:'องค์ประกอบ',type:'text',is_virtual:true,virtual_expr:source}],schemas);const error=Object.values(errors)[0];if(error)throw Error(error);}
 for(const name of customActions(layout))if(!actions.some(a=>a.name===name))throw Error('ไม่พบ Action ขององค์ประกอบ '+name);
 for(const n of customNodes(layout.children))if(n.type==='form'&&n.view){const table=views.find(v=>v.name===n.view)?.table_name;for(const column of Object.keys(n.defaults||{}))if(!table||!schemas[table]?.some(c=>c.name===column&&!c.is_virtual&&c.is_editable!==false&&c.is_editable!==0))throw Error('ค่าตั้งต้นฟอร์มต้องเลือกคอลัมน์ที่แก้ไขได้ '+column);}
}
