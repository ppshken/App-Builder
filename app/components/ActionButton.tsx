"use client";
import type { RowAction } from "@/lib/automation";
import { appearance } from "@/lib/action-config";
import { contrastRatio } from "@/lib/app-settings";
import Icon from "./Icon";
export default function ActionButton({ action, onClick, disabled = false }: {
    action: RowAction;
    onClick: () => void;
    disabled?: boolean;
}) { const a = appearance(action.appearance, action.kind); const light = a.color ? contrastRatio(a.color, "#172033") > contrastRatio(a.color, "#ffffff") : false; return <button type="button" aria-label={action.label} title={action.label} disabled={disabled} onClick={onClick} className={`configured-action ${a.position==="primary"&&a.style!=="circle"?"icon-button action-primary-icon":""} action-${a.style} action-${a.size} ${a.icon_only ? "action-icon-only" : ""} ${action.kind === "delete" && !a.color ? "danger" : ""}`} style={a.color ? { color: a.style === "solid" ? light ? "#172033" : "#fff" : a.color, background: a.style === "solid" ? a.color : undefined, borderColor: ["text","circle"].includes(a.style) ? "transparent" : a.color } : undefined}>{a.style==="circle"?<><span className="action-circle-icon" aria-hidden="true"><Icon name={a.icon}/></span><span className="action-circle-label">{action.label}</span></>:<><Icon name={a.icon}/>{!a.icon_only && action.label}</>}</button>; }
