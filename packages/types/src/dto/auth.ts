/**
 * 2FA（TOTP 双因子认证）契约 — apps/api 与 apps/admin BFF 共用
 * 方案见 docs/security/2fa-totp-design.md
 * 强制开关方案见 docs/security/2fa-enforcement-toggle-design.md
 */

/** POST /auth/login 响应：开启 2FA 的账号返回预鉴权态而非令牌（两态联合，强制化第三态本期不实施） */
export type LoginResult =
  | {
      requires2fa: false;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: {
        id: string;
        username: string;
        role: string;
        permissions?: string[];
        nickname?: string | null;
        email?: string | null;
        phone?: string | null;
      };
    }
  | {
      requires2fa: true;
      /** 预鉴权令牌，仅授予「进入 2FA 校验」资格，默认 300s */
      pendingToken: string;
      expiresIn: number;
    };

/** GET /auth/2fa/status 响应 */
export interface TwoFactorStatusResult {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
}

/** POST /auth/2fa/setup 响应 */
export interface TwoFactorSetupResult {
  /** otpauth://totp/... URI（TOTP-SHA1/6位/30s，兼容性优先的有意取舍） */
  otpauthUri: string;
  /** data:image/png;base64,... 前端 <img> 直接渲染 */
  qrDataUrl: string;
  /** 完整 base32 密钥（供无法扫码用户手动输入，仅 setup 一次性展示） */
  secret: string;
  /** 待确认 Secret 过期时间（ISO 8601） */
  expiresAt: string;
}

/** POST /auth/2fa/enable 响应 */
export interface TwoFactorEnableResult {
  /** 10 个恢复码（XXXXXXXX-XXXXXXXX，80 位熵），仅此一次明文返回 */
  recoveryCodes: string[];
}

/** POST /auth/2fa/verify 请求 */
export interface TwoFactorVerifyRequest {
  pendingToken: string;
  /** 6 位动态码（与 recoveryCode 二选一） */
  code?: string;
  /** 恢复码救急 */
  recoveryCode?: string;
}

/** POST /auth/2fa/verify 响应（等同现有 login 成功态，另带恢复码余量提醒） */
export interface TwoFactorVerifyResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    role: string;
    permissions?: string[];
    nickname?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /** 恢复码剩余 ≤2 时提醒重新生成 */
  warning?: string;
}

/** 全局安全策略设置（Setting 表 key='security.auth'，admin 专属） */
export interface SecurityAuthSettings {
  /** 强制全员启用两步验证 */
  twoFactorRequired: boolean;
}

/** 强制 2FA 期间未绑定用户被拦截的 403 错误码（前端据此跳转绑定页） */
export const TWOFA_ENROLLMENT_REQUIRED = 'TWOFA_ENROLLMENT_REQUIRED';

/** GET /auth/me 响应（登录用户资料 + 强制 2FA 引导标记） */
export interface MeResult {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  /** 强制开关已打开且本人未绑定 2FA（前端据此跳绑定页） */
  twoFactorSetupRequired: boolean;
}
