export const Role = {
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
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
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  type?: "access" | "refresh";
}
