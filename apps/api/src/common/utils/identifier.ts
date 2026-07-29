/**
 * 登录标识归一化工具（多标识登录方案，见 docs/login-multi-identifier-and-2fa-guide-design.md §3.2）。
 * email/phone 的所有写入口与登录查找必须走同一套归一化，否则唯一约束与登录匹配会失配。
 */

/** 邮箱归一化：去首尾空白 + 统一小写（登录匹配与写入共用同一口径） */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * 手机号归一化：去空格/连字符，剥离 +86 / 86 前缀，输出 11 位大陆手机号。
 * 不符合大陆手机号形态（座机/国际号等）返回 null——存量非标值保留原样、不参与登录匹配。
 */
export function normalizePhone(value: string): string | null {
  const stripped = value.replace(/[\s-]/g, '').replace(/^\+?86(?=1\d{10}$)/, '');
  return /^1\d{10}$/.test(stripped) ? stripped : null;
}

/**
 * 用户名白名单（防标识碰撞锁户 DoS，见方案 §3.2.1）：
 * 仅限字母、数字、_ . -，禁 @（杜绝与 email 碰撞）、禁纯 11 位手机号形态（杜绝与 phone 碰撞）。
 * 仅在 service 层对「新建 / 改名」校验——DTO 层校验会误伤编辑表单回填的存量违规用户名。
 */
export const USERNAME_PATTERN = /^(?!1\d{10}$)[A-Za-z0-9_.-]+$/;
