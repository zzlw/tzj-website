import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: '昵称格式不正确' })
  @MaxLength(64, { message: '昵称最多 64 个字符' })
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128, { message: '邮箱最多 128 个字符' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: '手机号格式不正确' })
  @MaxLength(32, { message: '手机号最多 32 个字符' })
  phone?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: '当前密码格式不正确' })
  @MinLength(6, { message: '当前密码至少 6 位' })
  @MaxLength(128, { message: '当前密码最多 128 位' })
  currentPassword!: string;

  @ApiProperty()
  @IsStrongPassword()
  newPassword!: string;
}
