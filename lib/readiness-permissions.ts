import {automaticRoleGrants} from './application-auto-grants';
import {db} from './db';
import {currentApplication} from './application-context';
import {currentAccess} from './permissions';
import {securitySeparated} from './builder-security';
import {validateRowRule} from './row-access';
import type {Column} from './columns';
import type {HealthIssue} from './readiness';
type View={name:string;table_name:string;kind:string;position:string};
type Grant={table_name:string;can_read:number;can_create:number;can_update:number;can_delete:number;can_export:number};
/** Static role checks only: never impersonate a user or execute Actions. */
export function inspectRolePermissions(views:View[],schemas:Record<string,Column[]>){
 const issues:HealthIssue[]=[],skipped:string[]=[];let checked=0;
 if(!currentAccess().owner)return {checked,issues,skipped:['สิทธิ์ผู้ใช้และบทบาท (ตรวจได้โดยเจ้าของระบบ)']};
 const app=currentApplication()?.id||'default',href='/app-access';
 const roles=(db.prepare('SELECT name,label,auto_grant FROM _application_local_roles WHERE app_id=?').all(app) as {name:string;label:string;auto_grant?:number}[]).map(role=>({...role,local:true}));
 // Legacy global roles remain effective until security separation is enabled.
 const separated=securitySeparated(db);
 if(!separated&&currentAccess().owner){
  for(const role of db.prepare('SELECT name,label FROM _roles WHERE builder=0').all() as {name:string;label:string}[]){
   if(app!=='default'&&!db.prepare('SELECT 1 FROM _application_roles WHERE app_id=? AND role_name=? AND can_use=1').get(app,role.name))continue;
   roles.push({...role,local:false});
  }
 }
 for(const role of roles){
  const target=role.local?href:'/users';
  const add=(severity:HealthIssue['severity'],message:string)=>issues.push({kind:'permission',name:role.name,label:'สิทธิ์บทบาท '+role.label,severity,message,href:target});
  const grants=(role.auto_grant?Object.entries(automaticRoleGrants(db,app,currentAccess().datasets||{}).tables).map(([table_name,r])=>({table_name,can_read:Number(r.read),can_create:Number(r.create),can_update:Number(r.update),can_delete:Number(r.delete),can_export:Number(r.export)})):role.local?db.prepare('SELECT * FROM _application_role_tables WHERE app_id=? AND role_name=?').all(app,role.name):db.prepare('SELECT * FROM _role_tables WHERE role_name=?').all(role.name)) as Grant[];
  const inScope=grants.filter(g=>!!schemas[g.table_name]);
  const readable=new Set(inScope.filter(g=>g.can_read&&(!currentAccess().datasets||currentAccess().datasets?.[g.table_name]?.read)).map(g=>g.table_name));
  checked++;
  if(!views.some(v=>['primary','menu'].includes(v.position)&&(['dashboard','custom'].includes(v.kind)||readable.has(v.table_name))))add('warning','ไม่มี View ในเมนูที่บทบาทนี้มีสิทธิ์อ่าน กรุณาตรวจตารางและสิทธิ์ของบทบาท');
  for(const g of inScope){
   checked++;
   if(!g.can_read&&(g.can_create||g.can_update||g.can_delete||g.can_export))add('error','ตาราง '+g.table_name+' เปิดสิทธิ์เพิ่ม แก้ไข ลบ หรือส่งออก แต่ยังไม่มีสิทธิ์อ่าน');
   if(!g.can_read)continue;
   for(const c of schemas[g.table_name])if(c.type==='ref'&&c.ref_table&&!readable.has(c.ref_table))add('warning','ตาราง '+g.table_name+' ช่อง '+c.label+' อ้างถึง '+c.ref_table+' แต่บทบาทนี้ไม่มีสิทธิ์อ่านตารางปลายทาง');
  }
  const rules=(role.local?db.prepare('SELECT table_name,operation,expression FROM _application_role_rows WHERE app_id=? AND role_name=?').all(app,role.name):db.prepare('SELECT table_name,operation,expression FROM _role_row_rules WHERE role_name=?').all(role.name)) as {table_name:string;operation:string;expression:string}[];
  for(const rule of rules.filter(r=>!!schemas[r.table_name])){checked++;try{validateRowRule(rule.expression,rule.table_name);}catch(e){add('error','กฎสิทธิ์แถว '+rule.table_name+' ('+rule.operation+'): '+(e instanceof Error?e.message:'สูตรไม่ถูกต้อง'));}}
 }
 return {checked,issues,skipped};
}
