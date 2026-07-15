import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * identify 升级：将匿名访客（visitorId）关联到已知身份。
 * 触发场景：官网提交询盘、客服留资、登录等。
 */
export class IdentifyDto {
  @ApiProperty({ description: '持久匿名访客 ID（localStorage）' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  visitorId!: string;

  @ApiPropertyOptional({ description: '已知身份 ID（如询盘 ID / 登录用户 ID），用于跨设备归并' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ description: '姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '电话' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: '公司/单位' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({ description: '额外画像（JSON 字符串或对象）' })
  @IsOptional()
  traits?: Record<string, unknown>;
}
