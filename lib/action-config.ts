import { ICON_CATALOG, type IconName } from "./icons";
export const ACTION_KINDS = { set: "เปลี่ยนค่าคอลัมน์", delete: "ลบแถวข้อมูล", copy: "คัดลอกแถวข้อมูล", add: "เพิ่มแถวข้อมูล", open_view: "เปิดหน้า View", open_url: "เปิดลิงก์", edit_form: "เปิดฟอร์มแก้ไขแถวนี้", new_form: "เปิดฟอร์มเพิ่มข้อมูล", call: "เปิดโทรศัพท์เพื่อโทรออก", sms: "เปิดข้อความ SMS", email: "เปิดอีเมล", grouped: "ทำหลาย Action ตามลำดับ", open_detail: "ดูรายละเอียดข้อมูล" } as const;
export type ActionKind = keyof typeof ACTION_KINDS;
export type ActionAppearance = {
    icon: IconName;
    style: "solid" | "outline" | "text";
    color: string;
    size: "small" | "normal" | "large";
    icon_only: boolean;
};
export type ActionConfig = {
    url_expr?: string;
    view_name?: string;
    actions?: string[];
    row_expr?: string;
    initial_values?: Record<string,string>;
};
export function actionPermission(kind:string):"read"|"create"|"update"|"delete" {return kind==="delete"?"delete":["copy","add","new_form"].includes(kind)?"create":["set","edit_form"].includes(kind)?"update":"read";}
export function appearance(value: any, kind: string = "set"): ActionAppearance { const a = { icon: kind === "call" ? "phone" : kind === "sms" ? "message" : kind === "email" ? "mail" : kind === "edit_form" ? "edit" : kind === "new_form" ? "plus" : kind === "grouped" ? "list" : kind === "delete" ? "trash" : kind === "copy" ? "copy" : kind === "add" ? "plus" : kind.startsWith("open_") ? "external" : "check", style: "outline", color: "", size: "normal", icon_only: false, ...value }; if (!ICON_CATALOG.some(i => i.name === a.icon) || !['solid', 'outline', 'text'].includes(a.style) || !['small', 'normal', 'large'].includes(a.size) || typeof a.icon_only !== "boolean" || typeof a.color !== "string" || a.color !== "" && !/^#[a-f\d]{6}$/i.test(a.color))
    throw Error("รูปแบบปุ่มไม่ถูกต้อง กรุณาเลือกไอคอน สไตล์ ขนาด และสี #RRGGBB"); return a; }
export function safeActionUrl(value: unknown) { if (typeof value !== "string" || value.length > 2000)
    throw Error("ลิงก์ต้องเป็นข้อความไม่เกิน 2,000 ตัวอักษร"); if (value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value))
    return value; try {
    const u = new URL(value);
    if (['http:', 'https:'].includes(u.protocol) && !u.username && !u.password)
        return u.href;
}
catch { } throw Error("ลิงก์ต้องเริ่มด้วย https://, http:// หรือ / และไม่มีชื่อผู้ใช้หรือรหัสผ่านในลิงก์"); }

export function communicationUrl(kind:string,value:unknown){if(typeof value!=="string"||!value.trim()||value.length>2000||/[\r\n\x00]/.test(value))throw Error("กรุณากำหนดเบอร์โทรหรืออีเมลเป็นข้อความไม่เกิน 2,000 ตัวอักษร");const text=value.trim();if(kind==="email"){if(!/^[^\s@?&#:,]+@[^\s@?&#:,]+\.[^\s@?&#:,]+$/.test(text))throw Error("อีเมลไม่ถูกต้อง กรุณาระบุอีเมลเดียว");return "mailto:"+encodeURIComponent(text).replace(/%40/g,"@");}if(!/^\+?[0-9 ()-]{3,30}$/.test(text))throw Error("เบอร์โทรไม่ถูกต้อง ใช้ตัวเลขและเครื่องหมาย + เท่านั้น");return (kind==="call"?"tel:":"sms:")+text.replace(/[ ()-]/g,"");}

export function actionConfigExpressions(config:ActionConfig):string[]{return [config.url_expr||"",config.row_expr||"",...Object.values(config.initial_values||{})].filter(Boolean);}
