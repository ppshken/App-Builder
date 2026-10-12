import {db,columnsOf} from './db';
import {assertIdentifier,calculateRow} from './columns';
import {writeRecord,type WriteOptions} from './data-write';
import {executeAction,actions,matches} from './automation';
import {expressionContext} from './expression-context';
export function saveFormRecord(table:string,values:Record<string,any>,id:number|undefined,viewName:string|null,email='',options?:WriteOptions){
 if(!viewName)return writeRecord(table,values,id,options);
 assertIdentifier(viewName);const view=db.prepare('SELECT table_name,kind,display_json FROM _views WHERE name=?').get(viewName) as {table_name:string;kind:string;display_json:string}|undefined;
 if(!view||view.table_name!==table||view.kind!=='form')throw Error('ไม่พบ View ฟอร์มของตารางนี้');const name=JSON.parse(view.display_json).form_saved_action||'';
 return db.transaction(()=>{const saved=writeRecord(table,values,id,options);if(!name)return saved;const action=actions(table).find(a=>a.name===name);if(!action)throw Error('ไม่มีสิทธิ์ใช้ Action หลังบันทึก หรือ Action ถูกลบแล้ว');const raw=db.prepare('SELECT * FROM "t_'+table+'" WHERE id=?').get(saved.id) as Record<string,unknown>;const now=new Date(),context=expressionContext(now,email);const row=calculateRow(columnsOf(table),raw,false,now,false,email,context).row;
 if(!matches(action.condition_expr,row,email,table,context))return {...saved,action:{ok:true,skipped:true}};
 return {...saved,action:executeAction(name,saved.id,email,null)};
 }).immediate();
}
