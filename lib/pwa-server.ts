import {platformDatabase,db} from './db';
import {validApplicationId,withApplication} from './application-context';
import {readAppSettings} from './settings-server';
import {themeColors} from './app-settings';
/** Only installation branding is public. No account, schema, row or permission data. */
export function pwaBrand(id:string){
 if(!validApplicationId(id)||!platformDatabase().prepare('SELECT 1 FROM _applications WHERE id=?').get(id))return null;
 return withApplication({id},()=>{const s=readAppSettings(true);let image='';if(s.icon_image.startsWith('/api/images/')){const row=db.prepare('SELECT mime,data FROM _images WHERE id=?').get(s.icon_image.slice(12)) as {mime:string;data:Buffer}|undefined;if(row&&['image/png','image/jpeg','image/webp'].includes(row.mime))image='data:'+row.mime+';base64,'+row.data.toString('base64');}return {name:s.name,color:themeColors(s,false).accent,image,icon:s.icon};});
}
