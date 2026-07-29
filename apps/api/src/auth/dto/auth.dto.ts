import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: '登录账号（用户名 / 邮箱 / 手机号）' })
  @IsString({ message: '账号格式不正确' })
  @MinLength(2, { message: '账号至少 2 个字符' })
  @MaxLength(128, { message: '账号最多 128 个字符' })
  username!: string;

  @ApiProperty({ example: 'Admin@123456', description: '密码' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(128, { message: '密码最多 128 位' })
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString({ message: '刷新令牌无效' })
  @MinLength(10, { message: '刷新令牌无效' })
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: '刷新令牌（用于撤销对应会话）' })
  @IsOptional()
  @IsString({ message: '刷新令牌无效' })
  refreshToken?: string;
}
