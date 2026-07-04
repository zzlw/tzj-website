import type { ApiResponse } from "@tzj/types";
import { ApiError } from "./api";

export async function fetchBySlug<T>(
  fetcher: (slug: string) => Promise<ApiResponse<T>>,
  slug: string,
): Promise<T | null> {
  try {
    const res = await fetcher(slug);
    return res.data ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function parseCaseSpecs(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is { label: string; value: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { value?: unknown }).value === "string",
  );
}
