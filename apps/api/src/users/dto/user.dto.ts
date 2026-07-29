import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'editor01' })
  @IsString({ message: '用户名格式不正确' })
  @MinLength(2, { message: '用户名至少 2 个字符' })
  @MaxLength(64, { message: '用户名最多 64 个字符' })
  username!: string;

  @ApiProperty({ example: 'Editor@123456' })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ example: '张编辑' })
  @IsOptional()
  @IsString({ message: '昵称格式不正确' })
  @MaxLength(64, { message: '昵称最多 64 个字符' })
  nickname?: string;

  @ApiPropertyOptional({ example: 'editor@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128, { message: '邮箱最多 128 个字符' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: '手机号格式不正确' })
  @MaxLength(32, { message: '手机号最多 32 个字符' })
  phone?: string;

  @ApiProperty({ example: 'editor', description: '角色标识（slug）' })
  @IsString({ message: '角色无效' })
  @MinLength(2, { message: '角色无效' })
  @MaxLength(64, { message: '角色无效' })
  role!: string;
}

// 注：UpdateUserDto 不含 password——改密统一走 reset-password 单一入口（G3）；
// 全局 ValidationPipe 为 whitelist: false，真正的防线在 service 不再读取该字段
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {
  @ApiPropertyOptional({ description: '是否启用账号' })
  @IsOptional()
  @IsBoolean({ message: '账号状态无效' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: '临时锁定截止时间（ISO 8601），传 null 解锁' })
  @IsOptional()
  @IsDateString({}, { message: '锁定截止时间格式不正确' })
  lockedUntil?: string | null;
}

export class ResetUserPasswordDto {
  @ApiProperty()
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ description: '操作者当前密码（重置其他管理员密码时必填）' })
  @IsOptional()
  @IsString({ message: '密码格式不正确' })
  actorPassword?: string;
}
