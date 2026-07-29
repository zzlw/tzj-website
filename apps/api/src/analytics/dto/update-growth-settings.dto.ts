import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/** 增长看板设置：广告花费手动录入（Phase1，用于询盘成本计算）。 */
export class UpdateGrowthSettingsDto {
  @ApiProperty({ description: '所选统计口径下的广告总花费（元），非负，最多两位小数' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  adSpend!: number;
}
