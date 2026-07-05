import { z } from "zod";

const localizedTextSchema = z.object({
  "zh-CN": z.string().optional(),
  "zh-TW": z.string().optional(),
  en: z.string().optional(),
});

const socialPlatformSchema = z.enum(["wechat", "douyin", "weibo", "xiaohongshu"]);

const optionalUrl = z
  .string()
  .max(2000)
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined))
  .refine((v) => v === undefined || /^https?:\/\//i.test(v), {
    message: "Invalid url",
  });

const socialChannelPurposeSchema = z.enum(["contact", "follow"]);

const socialChannelSchema = z.object({
  id: z.string().min(1).max(64),
  platform: socialPlatformSchema,
  purpose: socialChannelPurposeSchema.optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  qr: z.string().max(2000).optional(),
  href: optionalUrl,
});

export const sitePublicSettingsSchema = z.object({
  contact: z.object({
    phone: z.string().min(3).max(32),
    email: z.string().email().max(200),
    address: localizedTextSchema,
  }),
  legal: z.object({
    beian: z.string().min(1).max(64),
    beianUrl: z.string().url().max(500),
  }),
  social: z.object({
    channels: z.array(socialChannelSchema).max(20),
  }),
  analytics: z
    .object({
      geoMode: z.enum(["ip", "gps"]).default("ip"),
    })
    .default({ geoMode: "ip" }),
});

export type SitePublicSettingsInput = z.infer<typeof sitePublicSettingsSchema>;
