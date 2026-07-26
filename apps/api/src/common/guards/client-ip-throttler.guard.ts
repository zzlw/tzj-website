import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { extractClientIp } from '../utils/client-ip';

/**
 * 全局限流 Guard：tracker 改用 extractClientIp（受信代理才采信 XFF）。
 * 默认 ThrottlerGuard 取 req.ip，与 AuditLog/IpBanGuard 的口径不一致：
 * BFF 代理拓扑下 req.ip 恒为 BFF 地址，per-IP 限流会塌缩为全站共享桶
 * （攻击者打满即可把全体管理员挡在登录外）。统一为真实客户端 IP。
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    return extractClientIp(req) ?? req.ip ?? 'unknown';
  }
}
