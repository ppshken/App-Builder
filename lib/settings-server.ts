import {validateHeader} from "./header-settings";
import {validateNavigation} from "./navigation";
import {db} from "./db";
import {DEFAULT_SETTINGS,type AppSettings} from "./app-settings";
export function readAppSettings(publicOnly=false):AppSettings{
 const data=db.prepare(publicOnly?"SELECT name,icon,color,mode,font,font_weight,font_size,custom_color,loading_style,loading_text,icon_image,navigation_json,header_json FROM _app_settings WHERE id=1":"SELECT * FROM _app_settings WHERE id=1").get() as any;
 if(!data)return DEFAULT_SETTINGS;
 const {id,header_json,navigation_json,display_defaults_json,list_reference_version,...settings}=data;
 return {...DEFAULT_SETTINGS,...settings,image_allow_gallery:settings.image_allow_gallery===undefined?DEFAULT_SETTINGS.image_allow_gallery:!!settings.image_allow_gallery,header:validateHeader(JSON.parse(header_json||"{}")),navigation:validateNavigation(JSON.parse(navigation_json||"{}")),display_defaults:publicOnly?{}:JSON.parse(display_defaults_json||"{}")};
}
