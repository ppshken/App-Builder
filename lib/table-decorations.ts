import type Database from 'better-sqlite3';
import {tableDataStyles,validateDataStyles,type DataStyle} from './data-decoration';
import {effectiveColumns} from './shared-table-columns';
import {assertIdentifier} from './columns';
import {AuthError} from './auth';
export function tableDecorationViews(database:Database.Database,table:string){assertIdentifier(table);return (database.prepare('SELECT name,table_name,display_json FROM _views WHERE table_name=? ORDER BY pos,name').all(table) as {name:string;table_name:string;display_json:string}[]).map(v=>({...v,display:JSON.parse(v.display_json)}));}
export function readTableDataStyles(database:Database.Database,table:string){return tableDataStyles(tableDecorationViews(database,table),table);}
export function saveTableDataStyles(database:Database.Database,table:string,styles:Record<string,DataStyle>,base:unknown){
 assertIdentifier(table);validateDataStyles(styles,effectiveColumns(database,table));
 return database.transaction(()=>{const views=tableDecorationViews(database,table);if(!views.length)throw Error('กรุณาเพิ่ม View ของตารางนี้ก่อนตั้งค่าการตกแต่ง');
 if(typeof base!=='string'||JSON.stringify(tableDataStyles(views,table))!==base)throw new AuthError('การตกแต่งถูกเปลี่ยนจากหน้าอื่นแล้ว กรุณาโหลดใหม่ก่อนบันทึก',409);
 for(const view of views)database.prepare('UPDATE _views SET display_json=? WHERE name=?').run(JSON.stringify({...view.display,data_styles:styles,data_styles_scope:"table"}),view.name);
 return {ok:true,updated:views.length};}).immediate();
}
