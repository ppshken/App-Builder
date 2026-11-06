"use client";
import SearchSelect from './SearchSelect';
import {decimalPlaces} from '@/lib/decimal-format';
export default function DecimalPlacesEditor({id,options,busy,onChange}:{id:string;options?:string|null;busy?:boolean;onChange:(options:string)=>void}){
 return <div className="field"><label htmlFor={id}>จำนวนตำแหน่งทศนิยม</label><SearchSelect id={id} disabled={busy} value={decimalPlaces({options})??''} onChange={e=>onChange(e.target.value===''?'':JSON.stringify({decimal_places:Number(e.target.value)}))}><option value="">อัตโนมัติ · ตามค่าข้อมูล</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n} ตำแหน่ง</option>)}</SearchSelect><small className="hint">กำหนดเฉพาะการแสดงผล เช่น 2 ตำแหน่ง = 12.50 · ไม่ปัดค่าจริงที่บันทึกหรือใช้ในสูตร</small></div>;
}
