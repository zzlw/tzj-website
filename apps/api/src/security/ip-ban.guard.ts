import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { extractClientIp } from '../common/utils/client-ip';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpBanService } from './ip-ban.service';

/**
 * 全局 IP 封禁守卫：命中封禁名单的访客请求一律拒绝，覆盖询盘、聊天、内容等所有 HTTP 入口。
 *
 * 设计要点：
 * - 置于 JwtAuthGuard 之后（Throttler → JwtAuth → IpBan → Roles）：已认证的管理员/坐席
 *   （req.user 由 JwtAuthGuard 写入，公开路由携带有效令牌时亦会解析）一律放行，避免共享出口 IP
 *   或误封导致管理员自锁、连解封接口都打不开；仅拦截未认证的访客请求。
 * - isBlocked 走 60s 内存缓存，未命中缓存的 IP 立即判定放行，无额外数据库开销。
 */
@Injectable()
export class IpBanGuard implements CanActivate {
  constructor(private readonly ipBanService: IpBanService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 仅拦截 HTTP 请求；WebSocket 等其他上下文放行（无 req 可取）。
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    // 已认证用户（管理员/坐席）豁免：不封管理员，只封游客。
    if (req.user) return true;

    const ip = extractClientIp(req);
    if (await this.ipBanService.isBlocked(ip)) {
      throw new ForbiddenException('您的访问已被限制，如有疑问请联系管理员');
    }
    return true;
  }
}
