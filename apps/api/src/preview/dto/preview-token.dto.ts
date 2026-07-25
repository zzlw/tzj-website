import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/** 支持草稿预览的内容资源（与 API 路由前缀一致）。 */
export const PREVIEWABLE_RESOURCES = ['cases', 'news', 'blogs', 'trade-shows'] as const;

export type PreviewableResource = (typeof PREVIEWABLE_RESOURCES)[number];

export class PreviewTokenDto {
  @ApiProperty({ description: '资源类型', enum: PREVIEWABLE_RESOURCES })
  @IsIn(PREVIEWABLE_RESOURCES)
  resource!: PreviewableResource;

  @ApiProperty({ description: '内容 slug' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;
}
