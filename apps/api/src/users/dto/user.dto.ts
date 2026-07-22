import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'editor01' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'Editor@123456' })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ example: '张编辑' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ example: 'editor@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ example: 'editor', description: '角色标识（slug）' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role!: string;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsStrongPassword()
  password?: string;

  @ApiPropertyOptional({ description: '是否启用账号' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '临时锁定截止时间（ISO 8601），传 null 解锁' })
  @IsOptional()
  @IsDateString()
  lockedUntil?: string | null;
}

export class ResetUserPasswordDto {
  @ApiProperty()
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ description: '操作者当前密码（重置其他管理员密码时必填）' })
  @IsOptional()
  @IsString()
  actorPassword?: string;
}
