import type {AppView} from "./views";
export function viewNameError(label:unknown,views:{name:string;label:string}[],current?:{name:string;label:string}):string {
  if(typeof label!=="string"||!label.trim())return "กรุณากรอกชื่อ View";
  const normalized=label.trim().toLocaleLowerCase();
  // Existing duplicate names remain editable until the user chooses a new name.
  if(current&&current.label.trim().toLocaleLowerCase()===normalized)return "";
  return views.some(v=>v.name!==current?.name&&v.label.trim().toLocaleLowerCase()===normalized)?"ชื่อ View นี้มีอยู่แล้ว กรุณาตั้งชื่ออื่น (Display Name สามารถซ้ำกันได้)":"";
}
export function runtimeViewName<T extends Pick<AppView,"label"|"display">>(view:T):T{return {...view,label:view.display?.display_name?.trim()||view.label};}
