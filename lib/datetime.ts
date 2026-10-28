// Dates without an offset are entered in Thailand time, including datetime-local inputs.
export function normalizeDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new Error("กรุณากรอกวันและเวลาที่ถูกต้อง เช่น 2026-10-05T14:30");
  const [, day, hour, minute, second = "00", fraction, zone = "+07:00"] = match;
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day || +hour > 23 || +minute > 59 || +second > 59 || (zone !== "Z" && (+zone.slice(1, 3) > 14 || +zone.slice(4) > 59 || (+zone.slice(1, 3) === 14 && +zone.slice(4) !== 0))))
    throw new Error("วันหรือเวลาไม่ถูกต้อง กรุณาตรวจวันที่ ชั่วโมง และนาที");
  const instant = new Date(`${day}T${hour}:${minute}:${second}${fraction ? "." + fraction : ""}${zone}`);
  const local = new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString();
  if (!/^\d{4}-/.test(local)) throw new Error("ปีต้องอยู่ระหว่าง 0000 ถึง 9999");
  return local.slice(0, 23) + "+07:00";
}
export function dateTimeInput(value: unknown) {
  return typeof value === "string" && value ? normalizeDateTime(value).slice(0, 23) : "";
}
// Display only: keep ISO storage/input values and Thailand timezone semantics unchanged.
export function dateLabel(value:unknown){
 if(typeof value!=='string'||!value.trim())return '';
 const day=value.trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return value;
 const date=new Date(day+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return value;
 return day.slice(8,10)+'-'+day.slice(5,7)+'-'+day.slice(0,4);
}
export function dateTimeLabel(value: unknown) {
 if(typeof value!=='string'||!value.trim())return '';
 try{const local=normalizeDateTime(value.trim());return dateLabel(local.slice(0,10))+' '+local.slice(11,19);}catch{return value;}
}
