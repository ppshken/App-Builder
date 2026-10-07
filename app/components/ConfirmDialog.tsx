"use client";
import { useEffect, useRef } from "react";
export default function ConfirmDialog({ titleId, busy, onCancel, children }: {
  titleId: string; busy: boolean; onCancel: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="panel dialog native-dialog" aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}>{children}</dialog>;
}
