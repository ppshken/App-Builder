export const DESKTOP_NAVIGATION_STYLES=[
 {name:'sidebar',label:'ด้านข้างมาตรฐาน',description:'ย่อเป็นไอคอน และขยายเพื่อดูชื่อเมนู'},
 {name:'line',label:'เส้นเน้นด้านข้าง',description:'เส้นสีธีมกำกับเมนูที่เลือก'},
 {name:'solid',label:'เมนูสีทึบ',description:'เน้นเมนูที่เลือกด้วยพื้นสีธีม'},
 {name:'floating',label:'เมนูลอย',description:'แถบข้างมุมโค้ง เว้นระยะจากขอบ'},
 {name:'bottom',label:'แถบด้านล่าง',description:'แสดง Primary View ในแถบนำทางด้านล่าง'},
] as const;
export const NAVIGATION_STYLES = [
 {name:"standard",label:"มาตรฐาน",description:"ไอคอนพร้อมชื่อเมนู"},
 {name:"underline",label:"ขีดเส้นใต้",description:"เน้นเมนูด้วยเส้นด้านล่าง"},
 {name:"top-line",label:"เส้นด้านบน",description:"แถบสีเหนือเมนูที่เลือก"},
 {name:"icon-pill",label:"วงกลมไอคอน",description:"พื้นหลังนุ่มรอบไอคอน"},
 {name:"pill",label:"แคปซูล",description:"ไอคอนและชื่อในแคปซูล"},
 {name:"solid",label:"ไอคอนสีทึบ",description:"ไอคอนบนพื้นสีธีม"},
 {name:"raised",label:"ปุ่มเด่นยกสูง",description:"ยกปุ่มเมนูเด่นขึ้น"},
 {name:"raised-underline",label:"ปุ่มเด่นและเส้นใต้",description:"ปุ่มเด่นพร้อมเส้นเมนูที่เลือก"},
 {name:"raised-pill",label:"ปุ่มเด่นและแคปซูล",description:"ปุ่มเด่นพร้อมพื้นหลังเมนู"},
] as const;
export type NavigationSettings={style:typeof NAVIGATION_STYLES[number]["name"];labels:"always"|"active"|"none";surface:"full"|"floating";density:"comfortable"|"compact";featured_view:string;desktop:typeof DESKTOP_NAVIGATION_STYLES[number]["name"];height?:number|null};
export const DEFAULT_NAVIGATION:NavigationSettings={style:"standard",labels:"always",surface:"full",density:"comfortable",featured_view:"",desktop:"sidebar",height:null};
export function validateNavigation(value:unknown):NavigationSettings {
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(DEFAULT_NAVIGATION,k)))throw Error("การตั้งค่า Navigation Bar ไม่ถูกต้อง");
 const n={...DEFAULT_NAVIGATION,...value} as NavigationSettings;
 if(!NAVIGATION_STYLES.some(s=>s.name===n.style)||!["always","active","none"].includes(n.labels)||!["full","floating"].includes(n.surface)||!["comfortable","compact"].includes(n.density)||!DESKTOP_NAVIGATION_STYLES.some(s=>s.name===n.desktop))throw Error("กรุณาเลือกรูปแบบ Navigation Bar จากรายการ");
 if(typeof n.featured_view!=="string"||n.featured_view!==""&&!/^[a-z][a-z0-9_]{0,40}$/.test(n.featured_view))throw Error("กรุณาเลือกเมนูเด่นจาก Primary View");
 if(n.height!==null&&n.height!==undefined&&(typeof n.height!=="number"||!Number.isInteger(n.height)||n.height<52||n.height>100))throw Error("ความสูง Navigation Bar ต้องเป็นจำนวนเต็ม 52–100 พิกเซล หรือเว้นว่างเพื่อใช้อัตโนมัติ");
 return n;
}
export function featuredNavigationItem(ids:string[],settings:NavigationSettings){return ids.includes(settings.featured_view)?settings.featured_view:ids[Math.floor(ids.length/2)]||"";}

export function navigationHeight(settings:NavigationSettings){return typeof settings.height==='number'&&Number.isInteger(settings.height)&&settings.height>=52&&settings.height<=100?settings.height:settings.density==='compact'?56:60;}
