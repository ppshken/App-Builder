import type {Column} from './columns';
const column=(name:string,label:string,type='text'):Column=>({name,label,type,is_editable:false});
export const FORMULA_SYSTEM_TABLES=[
 {name:'_app_users',label:'ผู้ใช้ของแอป · อ่านอย่างเดียว',columns:[column('id','ID ผู้ใช้','number'),column('name','ชื่อผู้ใช้'),column('nickname','ชื่อเล่น'),column('role_id','ID บทบาท'),column('role_name','ชื่อบทบาท'),column('app_id','ID แอป')]},
 {name:'_app_user_roles',label:'บทบาทของแอป · อ่านอย่างเดียว',columns:[column('id','ID บทบาท'),column('name','ชื่อบทบาท'),column('app_id','ID แอป')]}
];
export function systemFormulaColumns(name:string){return FORMULA_SYSTEM_TABLES.find(table=>table.name===name)?.columns;}
export function isSystemFormulaTable(name:string){return !!systemFormulaColumns(name);}
export function systemFormulaSchema(){return Object.fromEntries(FORMULA_SYSTEM_TABLES.map(table=>[table.name,table.columns]));}
