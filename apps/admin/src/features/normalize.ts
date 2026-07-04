import type { FieldDef } from "@/components/crud/config";

/** 将表单原始值按字段类型规范化为 API 载荷。 */
export function normalizeValues(
  fields: FieldDef[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "tags") {
      out[f.name] = String(v ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (f.type === "gallery") {
      out[f.name] = Array.isArray(v) ? v : [];
    } else if (f.type === "datetime" || f.type === "date") {
      out[f.name] = v ? new Date(v as string).toISOString() : null;
    } else if (f.type === "key-value-list") {
      const arr = Array.isArray(v) ? (v as { label?: string; value?: string }[]) : [];
      out[f.name] = arr.filter((item) => item.label?.trim() || item.value?.trim());
    } else if (f.type === "string-list") {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      out[f.name] = arr.map((s) => String(s).trim()).filter(Boolean);
    } else if (f.type === "number") {
      out[f.name] =
        v === "" || v === undefined || Number.isNaN(v) ? undefined : v;
    } else if (f.type === "switch") {
      out[f.name] = Boolean(v);
    } else {
      out[f.name] = v === "" ? undefined : v;
    }
  }
  return out;
}
