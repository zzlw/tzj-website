import { z } from "zod";
import { INTEGRATION_SLUGS } from "./integration.registry";

export const updateIntegrationSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.string()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
});

export function assertIntegrationSlug(slug: string) {
  if (!INTEGRATION_SLUGS.has(slug)) {
    throw new Error(`Unknown integration slug: ${slug}`);
  }
}
