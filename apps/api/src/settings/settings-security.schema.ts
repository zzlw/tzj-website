import { z } from 'zod';

/** 安全策略设置（强制 2FA 开关），方案见 docs/security/2fa-enforcement-toggle-design.md */
export const securityAuthSettingsSchema = z.object({
  twoFactorRequired: z.boolean(),
});

export type SecurityAuthSettingsInput = z.infer<typeof securityAuthSettingsSchema>;
