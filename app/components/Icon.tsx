import type { SVGProps } from "react";
import { EXTRA_ICONS, type IconName } from "@/lib/icons";
export type { IconName } from "@/lib/icons";
const paths: Partial<Record<IconName, React.ReactNode>> = {
  home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></>,
  users: <><circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M19 14a6 6 0 0 1 3 5v2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M15 15h2"/></>,
  folder: <path d="M3 7V4h7l3 3h8v13H3Z"/>,
  tag: <><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7" cy="7" r="1"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></>,
  settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="11" r="3"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>, back: <path d="m12 5-7 7 7 7M5 12h15"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  edit: <><path d="m14 5 5 5M4 20l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19Z"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></>, check: <path d="m5 12 4 4L19 6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>, list: <path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"/>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  formula: <><path d="M18 4c-5-3-7 1-7 5l-2 10c-1 4-4 3-5 1M6 10h11"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 6h12M6 18h12"/></>,
  tablet: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 4v16"/></>,
  monitor: <><rect x="3" y="3" width="18" height="14" rx="1"/><path d="M8 21h8M12 17v4"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M19 17a8 8 0 0 1-13 2l-2-3"/></>,
  external: <><path d="M14 3h7v7M21 3l-10 10M10 3H4v17h17v-6"/></>,
};
export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || <path d={EXTRA_ICONS.find(i => i[0] === name)?.[3]}/> }</svg>;
}
