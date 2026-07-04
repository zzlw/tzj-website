import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "editor01" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: "Editor@123456" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: "张编辑" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ example: "editor@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ example: "editor", description: "角色标识（slug）" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role!: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ["password"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: "是否启用账号" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetUserPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
