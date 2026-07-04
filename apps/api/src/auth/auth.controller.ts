import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService, RequestMeta } from "./auth.service";
import { LoginDto, RefreshDto, LogoutDto } from "./dto/auth.dto";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/profile.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { AuthUser } from "./roles";

function metaFrom(req: Request & { id?: string }): RequestMeta {
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    traceId: req.id,
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "账号登录，返回访问/刷新令牌" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, metaFrom(req));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "使用刷新令牌轮换获取新令牌" })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, metaFrom(req));
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "退出登录并撤销当前会话" })
  logout(@Body() dto: LogoutDto, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, metaFrom(req));
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取当前登录用户" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新当前用户资料" })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Patch("password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "修改当前用户密码" })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
