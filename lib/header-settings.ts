import {iconImageUrl} from "./media-settings";
export type HeaderSettings={title_position:"left"|"center"|"right";title_source:"both"|"app"|"view"|"none";show_app_image:boolean;app_image:string;image_shape:"square"|"round";show_profile:boolean;profile_setting:string;show_notifications:boolean;notifications_view:string;show_reload:boolean};
export const DEFAULT_HEADER:HeaderSettings={title_position:"left",title_source:"both",show_app_image:true,app_image:"",image_shape:"square",show_profile:false,profile_setting:"",show_notifications:false,notifications_view:"",show_reload:true};
export function validateHeader(value:unknown):HeaderSettings {
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(DEFAULT_HEADER,k)))throw Error("การตั้งค่า Header ไม่ถูกต้อง");
 const h={...DEFAULT_HEADER,...value} as HeaderSettings;
 if(!["left","center","right"].includes(h.title_position)||!["both","app","view","none"].includes(h.title_source)||!["square","round"].includes(h.image_shape))throw Error("กรุณาเลือกรูปแบบ Header จากรายการ");
 for(const key of ["show_app_image","show_profile","show_notifications","show_reload"] as const)if(typeof h[key]!=="boolean")throw Error("การแสดงส่วน Header ต้องเป็นค่าเปิดหรือปิด");
 for(const key of ["profile_setting","notifications_view"] as const)if(typeof h[key]!=="string"||h[key]!==""&&!/^[a-z][a-z0-9_]{0,40}$/.test(h[key]))throw Error("กรุณาเลือกแหล่งข้อมูล Header จากรายการ");
 return {...h,app_image:iconImageUrl(h.app_image)};
}
export function headerProfileImage(settings:HeaderSettings,values:Record<string,unknown>={}){try{return settings.profile_setting?iconImageUrl(values[settings.profile_setting]??""):"";}catch{return "";}}
