import {isRemoteImageSource} from "./image-source";
import type Database from 'better-sqlite3';
import {imageFolder} from './media-settings';
export function recordMediaLocation(database:Database.Database,kind:'image'|'file',id:string,folder:string,name:string,copyPath=''){
 database.prepare('UPDATE _media_catalog SET folder=?,original_name=?,copy_path=? WHERE kind=? AND id=?').run(imageFolder(folder),name.slice(0,255),copyPath,kind,id);
}
// A validated persisted reference marks the upload committed; access claims remain intact.
export function publishMedia(database:Database.Database,value:unknown){
 const text=JSON.stringify(value,(_key,item)=>isRemoteImageSource(item)?null:item);if(!text)return;for(const m of text.matchAll(/\/api\/(images|files)\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})/gi))database.prepare('UPDATE _media_catalog SET published=1 WHERE kind=? AND id=?').run(m[1]==='images'?'image':'file',m[2]);
}
