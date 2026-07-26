import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** POST /auth/2fa/setup：生成待确认 Secret（防会话劫持者静默绑定，需重输密码） */
export class TwoFactorSetupDto {
  @ApiProperty({ description: '当前密码（二次确认）' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(128, { message: '密码最多 128 位' })
  password!: string;
}

/** POST /auth/2fa/enable：校验 6 位动态码确认绑定 */
export class TwoFactorEnableDto {
  @ApiProperty({ example: '123456', description: '6 位动态码' })
  @IsString({ message: '验证码格式不正确' })
  @Matches(/^\d{6}$/, { message: '验证码须为 6 位数字' })
  code!: string;

  @ApiPropertyOptional({
    description: '当前刷新令牌（用于标记当前会话已通过 2FA，避免启用后被误踢）',
  })
  @IsOptional()
  @IsString({ message: '刷新令牌无效' })
  refreshToken?: string;
}

/** POST /auth/2fa/verify：登录第二步（动态码与恢复码二选一） */
export class TwoFactorVerifyDto {
  @ApiProperty({ description: '登录第一步返回的预鉴权令牌' })
  @IsString({ message: '预鉴权令牌无效' })
  @MinLength(10, { message: '预鉴权令牌无效' })
  pendingToken!: string;

  @ApiPropertyOptional({ example: '123456', description: '6 位动态码（与 recoveryCode 二选一）' })
  @IsOptional()
  @IsString({ message: '验证码格式不正确' })
  @Matches(/^\d{6}$/, { message: '验证码须为 6 位数字' })
  code?: string;

  @ApiPropertyOptional({ example: 'XXXXXXXX-XXXXXXXX', description: '恢复码救急' })
  @IsOptional()
  @IsString({ message: '恢复码格式不正确' })
  @MaxLength(32, { message: '恢复码最多 32 个字符' })
  recoveryCode?: string;
}

/** POST /auth/2fa/disable：关闭 2FA（密码 + 动态码/恢复码双重确认） */
export class TwoFactorDisableDto {
  @ApiProperty({ description: '当前密码' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(128, { message: '密码最多 128 位' })
  password!: string;

  @ApiPropertyOptional({ example: '123456', description: '6 位动态码（与 recoveryCode 二选一）' })
  @IsOptional()
  @IsString({ message: '验证码格式不正确' })
  @Matches(/^\d{6}$/, { message: '验证码须为 6 位数字' })
  code?: string;

  @ApiPropertyOptional({ description: '恢复码救急' })
  @IsOptional()
  @IsString({ message: '恢复码格式不正确' })
  @MaxLength(32, { message: '恢复码最多 32 个字符' })
  recoveryCode?: string;
}

/** POST /auth/2fa/recovery-codes/regenerate：作废旧恢复码并生成新一批 */
export class TwoFactorRegenerateDto {
  @ApiProperty({ example: '123456', description: '6 位动态码' })
  @IsString({ message: '验证码格式不正确' })
  @Matches(/^\d{6}$/, { message: '验证码须为 6 位数字' })
  code!: string;
}

/** POST /auth/2fa/force-disable：运维救急（admin 强制关闭指定用户 2FA） */
export class TwoFactorForceDisableDto {
  @ApiProperty({ description: '目标用户 ID' })
  @IsString({ message: '目标用户 ID 无效' })
  @MinLength(1, { message: '目标用户 ID 不能为空' })
  targetUserId!: string;

  @ApiProperty({ description: '操作者自身密码（二次确认）' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(128, { message: '密码最多 128 位' })
  password!: string;
}
