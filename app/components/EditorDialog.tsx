"use client";
import { useEffect, useRef } from "react";
import Icon from "./Icon";
export default function EditorDialog({ title, subtitle, busy = false, onClose, children, footer, wide = false, columnDialog = false, actions, className = "" }: {
  title: string; subtitle?: React.ReactNode; busy?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; columnDialog?: boolean; actions?: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current!; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={ref} className={`editor-dialog ${wide ? "wide-dialog" : ""} ${columnDialog ? "column-dialog" : ""} ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className="dialog-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{actions}<button className="icon-button" aria-label={`ปิด${title}`} disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
    <div className="dialog-body">{children}</div>{footer && <footer className="dialog-footer">{footer}</footer>}
  </dialog>;
}
