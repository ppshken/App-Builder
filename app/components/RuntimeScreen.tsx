"use client";
import { useEffect, useRef } from "react";
import RuntimePageTrail from "./RuntimePageTrail";
import Icon from "./Icon";
export default function RuntimeScreen({ title, subtitle, busy = false, onClose, children, footer, actions }: {
  title: string; subtitle?: React.ReactNode; busy?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus({preventScroll:true}); return () => { if (previous?.isConnected) previous.focus({preventScroll:true}); }; }, []);
  return <section ref={ref} tabIndex={-1} className="runtime-screen" role="region" aria-label={title} onKeyDown={e => { if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); } }}>
    <RuntimePageTrail/>
    <header className="runtime-screen-header"><button className="icon-button runtime-screen-back" aria-label="กลับหน้าก่อนหน้า" title="กลับหน้าก่อนหน้า" disabled={busy} onClick={onClose}><Icon name="back"/></button><div><h2 title={title}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="runtime-screen-actions">{actions}</div></header>
    <div className="runtime-screen-body">{children}</div>{footer && <footer className="runtime-screen-footer">{footer}</footer>}
  </section>;
}
