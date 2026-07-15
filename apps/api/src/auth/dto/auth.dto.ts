import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: '用户名' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'Admin@123456', description: '密码' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: '刷新令牌（用于撤销对应会话）' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
