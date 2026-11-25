export type AiViewDraft = { label: string; table: string; kind: "table" | "list" };

export function aiViewDraft(value: unknown): AiViewDraft | null {
  if (!value || typeof value !== "object") return null;
  const { label, table, kind } = value as Record<string, unknown>;
  if (typeof label !== "string" || !label.trim() || label.trim().length > 80 ||
      typeof table !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(table) ||
      (kind !== "table" && kind !== "list")) return null;
  return { label: label.trim(), table, kind };
}
