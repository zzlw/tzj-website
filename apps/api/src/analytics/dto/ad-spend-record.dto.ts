import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AD_PLATFORMS, type AdPlatform } from '@tzj/types';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 广告花费台账记录入参（新增/编辑共用，docs/ad-spend-ledger-design.md §5）。
 * 跨字段校验（periodEnd >= periodStart、不得晚于今天、区间重叠）在 AdSpendService 内进行。
 */
export class AdSpendRecordDto {
  @ApiProperty({ description: '投放平台', enum: AD_PLATFORMS })
  @IsIn(AD_PLATFORMS)
  platform!: AdPlatform;

  @ApiProperty({ description: '记账区间起始日（YYYY-MM-DD，含）' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'periodStart 须为 YYYY-MM-DD' })
  periodStart!: string;

  @ApiProperty({ description: '记账区间结束日（YYYY-MM-DD，含；不得晚于今天）' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'periodEnd 须为 YYYY-MM-DD' })
  periodEnd!: string;

  @ApiProperty({ description: '花费金额（元），非负，最多两位小数' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999.99)
  spend!: number;

  @ApiPropertyOptional({ description: '备注（如账单号、投放说明）' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
