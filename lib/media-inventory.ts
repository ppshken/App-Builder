import type Database from 'better-sqlite3';
import {APPLICATION_CONFIG_TABLES,applicationTable} from './application-context';
export type Reference={app_id:string;table:string;column:string;row_id:string};
export type MediaEntry={kind:'image'|'file';id:string;name:string;mime:string;size:number;created_at:number|null;user_id:number|null;app_id:string|null;references:Reference[];folder?:string;copy_path?:string;pending?:boolean};
export function mediaReferences(db:Database.Database){
 const refs=new Map<string,Reference[]>(),add=(value:unknown,ref:Reference)=>{if(typeof value!=='string')return;for(const m of value.matchAll(/\/api\/(images|files)\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})/gi)){const key=(m[1]==='images'?'image:':'file:')+m[2],list=refs.get(key)||[];if(!list.some(r=>r.app_id===ref.app_id&&r.table===ref.table&&r.column===ref.column&&r.row_id===ref.row_id))list.push(ref);refs.set(key,list);}};
 const tables=db.prepare('SELECT name,owner_app_id FROM _tables').all() as {name:string;owner_app_id:string}[];
 for(const table of tables){const apps=new Set([table.owner_app_id,...(db.prepare('SELECT app_id FROM _application_datasets WHERE table_name=? AND can_read=1').all(table.name) as {app_id:string}[]).map(r=>r.app_id)]);
  for(const c of db.prepare('SELECT * FROM _columns WHERE table_name=?').all(table.name) as Record<string,unknown>[])for(const [column,value] of Object.entries(c))for(const app of apps)add(value,{app_id:app,table:'_columns',column,row_id:String(c.id)});
  for(const c of db.prepare("SELECT name FROM _columns WHERE table_name=? AND is_virtual=0 AND type IN ('image','file','signature','text','longtext','list','enumlist')").all(table.name) as {name:string}[]){
   for(const row of db.prepare('SELECT id,"'+c.name+'" value FROM "t_'+table.name+'" WHERE instr(CAST("'+c.name+'" AS TEXT),\'/api/\')>0').iterate() as Iterable<{id:number;value:unknown}>)for(const app of apps)add(row.value,{app_id:app,table:table.name,column:c.name,row_id:String(row.id)});
  }
 }
 for(const app of db.prepare('SELECT id FROM _applications').all() as {id:string}[])for(const logical of APPLICATION_CONFIG_TABLES){for(const row of db.prepare('SELECT * FROM "'+applicationTable(app.id,logical)+'"').iterate() as Iterable<Record<string,unknown>>)for(const [column,value] of Object.entries(row))add(value,{app_id:app.id,table:logical,column,row_id:String(row.name??row.id??'')});}
 for(const profile of db.prepare('SELECT user_id,avatar FROM _user_profiles').all() as {user_id:number;avatar:string}[])add(profile.avatar,{app_id:'',table:'_user_profiles',column:'avatar',row_id:String(profile.user_id)});
 return refs;
}
export function mediaInventory(db:Database.Database,app=''){
 const refs=mediaReferences(db),result:MediaEntry[]=[],catalog=new Map((db.prepare('SELECT * FROM _media_catalog').all() as any[]).map(m=>[m.kind+':'+m.id,m])),stagedImages=new Set((db.prepare('SELECT image_id FROM _image_uploads').all() as {image_id:string}[]).map(r=>r.image_id)),stagedFiles=new Set((db.prepare('SELECT file_id FROM _file_uploads').all() as {file_id:string}[]).map(r=>r.file_id));
 for(const [kind,table] of [['image','_images'],['file','_files']] as const){for(const row of db.prepare('SELECT id,mime,length(data) size'+(kind==='file'?',name':',storage_path')+' FROM '+table).all() as {id:string;mime:string;size:number;name?:string;storage_path?:string}[]){const meta=catalog.get(kind+':'+row.id) as {app_id:string;created_at:number;user_id:number;folder:string;original_name:string;copy_path:string;published:number}|undefined,references=refs.get(kind+':'+row.id)||[];if(app&&meta?.app_id!==app&&!references.some(r=>r.app_id===app))continue;result.push({...row,kind,name:row.name||meta?.original_name||row.id,folder:meta?.folder||((row.storage_path||'').startsWith('uploads/')?(row.storage_path||'').split('/').slice(1,-1).join('/'):''),copy_path:meta?.copy_path||row.storage_path||'',pending:!meta?.published&&(kind==='image'?stagedImages:stagedFiles).has(row.id),created_at:meta?.created_at??null,user_id:meta?.user_id??null,app_id:meta?.app_id??null,references});}}
 return result;
}
export function deleteUnusedMedia(db:Database.Database,kind:string,id:string,checked?:Map<string,Reference[]>){
 if(!['image','file'].includes(kind)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw Error('รหัสไฟล์ไม่ถูกต้อง');
 return db.transaction(()=>{if((checked||mediaReferences(db)).get(kind+':'+id)?.length)throw Error('ไฟล์ยังถูกอ้างอิงอยู่ ไม่สามารถลบได้');const table=kind==='image'?'_images':'_files';db.prepare('DELETE FROM '+(kind==='image'?'_image_uploads WHERE image_id=?':'_file_uploads WHERE file_id=?')).run(id);const result=db.prepare('DELETE FROM '+table+' WHERE id=?').run(id);if(!result.changes)throw Error('ไม่พบไฟล์');db.prepare('DELETE FROM _media_catalog WHERE kind=? AND id=?').run(kind,id);return {ok:true};}).immediate();
}
