import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 官网留言提交（公开）。 */
export class CreateContactDto {
  @ApiProperty({ description: '姓名' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ description: '留言内容' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: '电话' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: '公司/单位' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({ description: '主题' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({ description: '来源: website|admin|api' })
  @IsOptional()
  @IsString()
  source?: string;
}

/** 后台处理询盘（标记已读/已处理/备注）。 */
export class UpdateContactDto {
  @ApiPropertyOptional({ description: '是否已读' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: '是否已处理' })
  @IsOptional()
  @IsBoolean()
  isHandled?: boolean;

  @ApiPropertyOptional({ description: '处理备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;
}
