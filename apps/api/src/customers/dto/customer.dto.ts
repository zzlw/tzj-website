import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ description: '客户单位 / 公司' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional({ description: '联系人职务' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({
    description: '客户类型: fire|armed-police|military|scenic|school|enterprise|government|other',
  })
  @IsOptional()
  @IsString()
  customerType?: string;

  @ApiPropertyOptional({
    description: '客户来源: website|exhibition|referral|cold-call|existing|other',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: '客户等级: A| B| C' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: '跟进阶段: new|following|intent|deal|lost',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ description: '预估金额（元）' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ description: '地区' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  address?: string;

  @ApiPropertyOptional({ type: [String], description: '标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '备注 / 跟进摘要' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: '来源会话 roomId（在线客服转线索，幂等去重）' })
  @IsOptional()
  @IsString()
  chatRoomId?: string;

  @ApiPropertyOptional({ description: '归属坐席 ID（空 = 公海；不传则创建人自动归入私海）' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: '最近联系时间（ISO）' })
  @IsOptional()
  @IsDateString()
  lastContactAt?: string | null;

  @ApiPropertyOptional({ description: '下次跟进时间（ISO）' })
  @IsOptional()
  @IsDateString()
  nextFollowAt?: string | null;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class TransferCustomerDto {
  @ApiProperty({ description: '接收方坐席 ID（转移至其私海）' })
  @IsString()
  @MinLength(1)
  toUserId!: string;
}
