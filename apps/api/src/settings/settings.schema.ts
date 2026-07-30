import { z } from 'zod';

const localizedTextSchema = z.object({
  'zh-CN': z.string().optional(),
  'zh-TW': z.string().optional(),
  en: z.string().optional(),
});

const socialPlatformSchema = z.enum(['wechat', 'douyin', 'weibo', 'xiaohongshu']);

const optionalUrl = z
  .string()
  .max(2000)
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined))
  .refine((v) => v === undefined || /^https?:\/\//i.test(v), {
    message: 'Invalid url',
  });

const socialChannelPurposeSchema = z.enum(['contact', 'follow']);

const socialChannelSchema = z.object({
  id: z.string().min(1).max(64),
  platform: socialPlatformSchema,
  purpose: socialChannelPurposeSchema.optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  qr: z.string().max(2000).optional(),
  href: optionalUrl,
});

const businessHoursSchema = z.object({
  enabled: z.boolean().default(true),
  timezone: z.string().min(1).max(64).default('Asia/Shanghai'),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
  startHour: z.number().int().min(0).max(23).default(9),
  endHour: z.number().int().min(0).max(23).default(18),
  holidays: z
    .array(z.string().regex(/^\d{2}-\d{2}$/, 'MM-DD'))
    .max(60)
    .default([]),
});

const agentProfileSchema = z.object({
  name: z.string().min(1).max(32).default('客服小拓'),
  /** 头像：空字符串表示使用昵称首字兜底 */
  avatar: z.string().max(2000).default(''),
  title: z.string().min(1).max(32).default('在线客服'),
  greeting: z.string().min(1).max(500).default('您好 👋\n\n请描述您的问题，我会尽快为您解答。'),
  /** 首次响应时间承诺（分钟），用于 C 端「通常 X 分钟内回复」SLA 提示；留空则显示「通常几分钟内回复」 */
  responseMinutes: z.number().int().min(1).max(1440).optional(),
});

const chatPromptsSchema = z.object({
  offlineMessage: localizedTextSchema.default({}),
  noAgentMessage: localizedTextSchema.default({}),
});

const screenWatermarkSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().max(64).default(''),
  opacity: z.number().min(0.02).max(0.3).default(0.08),
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
      geoMode: z.enum(['ip', 'gps']).default('ip'),
      baiduHmId: z.string().max(64).optional(),
    })
    .default({ geoMode: 'ip' }),
  businessHours: businessHoursSchema.default({
    enabled: true,
    timezone: 'Asia/Shanghai',
    weekdays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
    holidays: [],
  }),
  agentProfile: agentProfileSchema.default({
    name: '客服小拓',
    avatar: '',
    title: '在线客服',
    greeting: '您好 👋\n\n请描述您的问题，我会尽快为您解答。',
  }),
  chatPrompts: chatPromptsSchema.default({
    offlineMessage: {},
    noAgentMessage: {},
  }),
  screenWatermark: screenWatermarkSchema.default({ enabled: false, text: '', opacity: 0.08 }),
});

export type SitePublicSettingsInput = z.infer<typeof sitePublicSettingsSchema>;
