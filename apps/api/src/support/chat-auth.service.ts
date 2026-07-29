import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ConfigService } from '@nestjs/config';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { JwtService } from '@nestjs/jwt';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { RolesService } from '../access/roles.service';

/**
 * 聊天专用令牌（chat token）。
 *
 * 为什么需要独立的 chat token，而不是直接复用登录 JWT？
 *  - 访客（client）没有账号体系，无法走登录 JWT；需要一个「仅限聊天作用域」的短令牌。
 *  - 坐席（agent）虽有登录 JWT，但那是业务系统令牌，作用域/有效期与「长连 socket」不同。
 *    用独立的 scope=chat 令牌，可在网关握手阶段一次性校验，并据此推导发送者身份，
 *    杜绝客户端自报身份（C1/C2/C3 安全闭环的核心）。
 *
 * 令牌 claim：
 *  - sub:   client=clientEmail；agent=userId
 *  - email: client=clientEmail；agent=登录用户名（即 assignedAgentEmail 使用的标识）
 *  - type:  'client' | 'agent'
 *  - role:  agent 的角色（admin/editor/viewer）
 *  - scope: 'chat'（网关只认 scope=chat 的令牌）
 *  - iat/exp 由 JwtService 自动管理
 */
export interface ChatTokenPayload {
  sub: string;
  email: string;
  type: 'client' | 'agent';
  role?: string;
  scope: 'chat';
  iat?: number;
  exp?: number;
}

@Injectable()
export class ChatAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
  ) {}

  private secret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  /** 访客令牌：与某个房间/邮箱绑定，长期有效（访客刷新页面后用于重连）。 */
  issueClientToken(roomId: string, clientEmail: string): string {
    return this.jwt.sign(
      { sub: clientEmail, email: clientEmail, type: 'client', scope: 'chat', roomId },
      { secret: this.secret(), expiresIn: '30d' },
    );
  }

  /** 坐席令牌：短期有效（与登录会话解耦，但同样需要 server 端用 access token 换取）。 */
  issueAgentToken(userId: string, email: string, role: string): string {
    return this.jwt.sign(
      { sub: userId, email, type: 'agent', role, scope: 'chat' },
      { secret: this.secret(), expiresIn: '15m' },
    );
  }

  /** 校验 chat token；失败抛 UnauthorizedException（网关据此断开连接）。 */
  verify(token: string): ChatTokenPayload {
    let payload: ChatTokenPayload;
    try {
      payload = this.jwt.verify<ChatTokenPayload>(token, { secret: this.secret() });
    } catch {
      throw new UnauthorizedException('聊天令牌无效或已过期');
    }
    if (payload.scope !== 'chat') {
      throw new UnauthorizedException('聊天令牌作用域错误');
    }
    if (payload.type !== 'client' && payload.type !== 'agent') {
      throw new UnauthorizedException('聊天令牌类型错误');
    }
    if (!payload.email) {
      throw new UnauthorizedException('聊天令牌缺少身份');
    }
    return payload;
  }

  /**
   * 用业务系统 access token 换取坐席 chat token。
   * 仅当 access token 合法且 type==='access' 时才签发，避免用 refresh/任意 JWT 冒充坐席。
   * 额外要求持有 chat.view 权限（P1b）：否则任何登录用户都能绕过 RolesGuard
   * 成为坐席读取全部客户会话。权限吊销后无需额外处理——坐席 token 仅 15 分钟
   * 有效期，自然过期后重新兑换即被此处拦截。
   */
  async exchangeAgentToken(
    accessToken: string,
  ): Promise<{ token: string; email: string; role: string }> {
    let payload: { sub: string; username: string; role: string; type?: string };
    try {
      payload = this.jwt.verify<typeof payload>(accessToken, { secret: this.secret() });
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('令牌类型错误');
    }
    const perms = await this.roles.getPermissionsForSlug(payload.role);
    if (!perms.includes('chat.view')) {
      throw new ForbiddenException('无客服聊天权限，无法兑换坐席令牌');
    }
    const email = payload.username;
    const token = this.issueAgentToken(payload.sub, email, payload.role);
    return { token, email, role: payload.role };
  }
}
