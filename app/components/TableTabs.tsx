import Link from "next/link";
import Icon from "./Icon";
export default function TableTabs({ table, selected }: { table: string; selected: "data" | "columns" | "raw" }) {
  return <nav className="table-tabs" aria-label="ส่วนของตาราง"><Link aria-current={selected === "columns" ? "page" : undefined} href={`/t/${table}/edit`}><Icon name="settings"/>คอลัมน์และการตั้งค่า</Link><Link aria-current={selected === "data" ? "page" : undefined} href={`/t/${table}`}><Icon name="table"/>ข้อมูล</Link><Link aria-current={selected === "raw" ? "page" : undefined} href={`/t/${table}/raw`}><Icon name="database"/>ข้อมูลจริงในฐานข้อมูล</Link></nav>;
}
