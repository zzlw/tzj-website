import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { extractClientIp } from '../common/utils/client-ip';
import type { RequestMeta } from './auth.service';
import { AllowUnenrolled } from './decorators/allow-unenrolled.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import {
  TwoFactorDisableDto,
  TwoFactorEnableDto,
  TwoFactorForceDisableDto,
  TwoFactorRegenerateDto,
  TwoFactorSetupDto,
  TwoFactorVerifyDto,
} from './dto/two-factor.dto';
import type { AuthUser } from './roles';
import { TwoFactorService } from './two-factor.service';

function metaFrom(req: Request & { id?: string }): RequestMeta {
  return {
    ip: extractClientIp(req),
    userAgent: req.headers['user-agent'],
    traceId: req.id,
  };
}

/** 敏感操作统一 5 次/分钟（per-IP，tracker 见 ClientIpThrottlerGuard） */
const STRICT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @AllowUnenrolled()
  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前用户 2FA 状态（是否启用/恢复码余量）' })
  status(@CurrentUser() user: AuthUser) {
    return this.twoFactor.status(user.id);
  }

  @AllowUnenrolled()
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiBearerAuth()
  @ApiOperation({ summary: '生成待确认 TOTP Secret（需密码二次确认），返回二维码' })
  setup(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorSetupDto, @Req() req: Request) {
    return this.twoFactor.setup(user.id, dto.password, metaFrom(req));
  }

  @AllowUnenrolled()
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiBearerAuth()
  @ApiOperation({ summary: '校验动态码确认绑定，返回恢复码（唯一一次明文）' })
  enable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorEnableDto, @Req() req: Request) {
    return this.twoFactor.enable(user.id, dto.code, metaFrom(req), dto.refreshToken);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: '登录第二步：校验动态码/恢复码，签发正式令牌' })
  verify(@Body() dto: TwoFactorVerifyDto, @Req() req: Request) {
    return this.twoFactor.verify(dto.pendingToken, dto.code, dto.recoveryCode, metaFrom(req));
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiBearerAuth()
  @ApiOperation({ summary: '关闭 2FA（密码 + 动态码/恢复码双重确认）' })
  disable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto, @Req() req: Request) {
    return this.twoFactor.disable(user.id, dto.password, dto.code, dto.recoveryCode, metaFrom(req));
  }

  @Post('recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiBearerAuth()
  @ApiOperation({ summary: '作废旧恢复码并生成新一批（需动态码确认）' })
  regenerate(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorRegenerateDto,
    @Req() req: Request,
  ) {
    return this.twoFactor.regenerateRecoveryCodes(user.id, dto.code, metaFrom(req));
  }

  @Post('force-disable')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '运维救急：admin 强制关闭指定用户 2FA（高危，操作即审计）' })
  forceDisable(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorForceDisableDto,
    @Req() req: Request,
  ) {
    return this.twoFactor.forceDisable(user.id, dto.targetUserId, dto.password, metaFrom(req));
  }
}
