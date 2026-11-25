export type AiAutomationDraft = { label: string; table: string; event: "manual" | "create" | "update"; action: string };

export function aiAutomationDraft(value: unknown): AiAutomationDraft | null {
  if (!value || typeof value !== "object") return null;
  const { label, table, event, action } = value as Record<string, unknown>;
  const identifier = /^[a-z][a-z0-9_]{0,40}$/;
  if (typeof label !== "string" || !label.trim() || label.trim().length > 80 ||
      typeof table !== "string" || !identifier.test(table) ||
      typeof action !== "string" || !identifier.test(action) ||
      (event !== "manual" && event !== "create" && event !== "update")) return null;
  return { label: label.trim(), table, event, action };
}
