import type { SecurityAuthSettings } from '@tzj/types';

export const SECURITY_AUTH_SETTING_KEY = 'security.auth';

/** 默认关闭强制：无 Setting 行时回落默认值，向后兼容零迁移 */
export const DEFAULT_SECURITY_AUTH_SETTINGS: SecurityAuthSettings = {
  twoFactorRequired: false,
};

export function mergeSecurityAuthSettings(
  partial?: Partial<SecurityAuthSettings> | null,
): SecurityAuthSettings {
  if (!partial) return DEFAULT_SECURITY_AUTH_SETTINGS;
  return {
    twoFactorRequired:
      partial.twoFactorRequired ?? DEFAULT_SECURITY_AUTH_SETTINGS.twoFactorRequired,
  };
}
