export const Role = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  /** 强制 2FA 守卫短路用：JwtStrategy 每请求查库顺带带出，零额外查询 */
  twoFactorEnabled?: boolean;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  type?: 'access' | 'refresh' | 'twofa_pending';
  /** 2FA 预鉴权令牌单用标识（type=twofa_pending 时必带） */
  jti?: string;
}
