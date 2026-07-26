import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser, JwtPayload, Role } from '../roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // 仅接受 access 令牌：refresh / twofa_pending（预鉴权）均不得当作登录态使用
    if (payload.type !== 'access') {
      throw new UnauthorizedException('令牌类型错误');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      nickname: user.nickname,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
