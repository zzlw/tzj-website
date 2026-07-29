import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { extractClientIp } from '../common/utils/client-ip';
import type { RequestMeta } from './auth.service';
import { AuthService } from './auth.service';
import { AllowUnenrolled } from './decorators/allow-unenrolled.decorator';
import { AuthenticatedOnly } from './decorators/authenticated-only.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, LogoutDto, RefreshDto } from './dto/auth.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';
import type { AuthUser } from './roles';

function metaFrom(req: Request & { id?: string }): RequestMeta {
  return {
    // 统一真实 IP 口径（受信代理才采信 XFF），避免 BFF 拓扑下审计源 IP 恒为 BFF 地址
    ip: extractClientIp(req),
    userAgent: req.headers['user-agent'],
    traceId: req.id,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '账号登录，返回访问/刷新令牌' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, metaFrom(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用刷新令牌轮换获取新令牌' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, metaFrom(req));
  }

  @AllowUnenrolled()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录并撤销当前会话' })
  logout(@Body() dto: LogoutDto, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, metaFrom(req));
  }

  @AllowUnenrolled()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @AuthenticatedOnly()
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新当前用户资料' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @AuthenticatedOnly()
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改当前用户密码' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @AuthenticatedOnly()
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户活跃会话列表' })
  getSessions(@CurrentUser() user: AuthUser) {
    return this.auth.getSessions(user.id);
  }

  @AuthenticatedOnly()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '撤销指定会话（仅限自己的）' })
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') sessionId: string) {
    return this.auth.revokeSession(user.id, sessionId);
  }

  @AuthenticatedOnly()
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '撤销其他所有会话（保留当前会话）' })
  revokeOtherSessions(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto, @Req() req: Request) {
    return this.auth.revokeOtherSessions(user.id, dto.refreshToken);
  }
}
