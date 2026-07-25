import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/** 草稿预览令牌载荷：绑定资源类型 + slug，防止一枚令牌越权预览任意内容。 */
interface PreviewTokenPayload {
  scope: 'preview';
  resource: string;
  slug: string;
}

/** 令牌有效期：够编辑打开预览核对，过期后需回后台重新生成（业内惯例 15m~1h）。 */
const PREVIEW_TOKEN_TTL = '30m';

@Injectable()
export class PreviewTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  sign(resource: string, slug: string): Promise<string> {
    const payload: PreviewTokenPayload = { scope: 'preview', resource, slug };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: PREVIEW_TOKEN_TTL,
    });
  }

  /** 校验令牌是否允许预览指定资源；缺失/过期/不匹配一律返回 false（回退为公开可见性）。 */
  async verify(token: string | undefined, resource: string, slug: string): Promise<boolean> {
    if (!token) return false;
    try {
      const payload = await this.jwt.verifyAsync<PreviewTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      return payload.scope === 'preview' && payload.resource === resource && payload.slug === slug;
    } catch {
      return false;
    }
  }
}
