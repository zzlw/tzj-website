import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class CreateTradeShowDto {
  @ApiProperty({ description: '展会/活动名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'URL slug，全站唯一' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional({ description: '简介' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '详情（Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '举办地点' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '展示用日期文字，如 年度展会、2026年5月' })
  @IsOptional()
  @IsString()
  eventDateLabel?: string;

  @ApiPropertyOptional({ description: '开始日期（ISO）' })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: '结束日期（ISO）' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ description: '展位号' })
  @IsOptional()
  @IsString()
  boothNumber?: string;

  @ApiPropertyOptional({
    description: '类型: exhibition|seminar|roadshow',
    default: 'exhibition',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ type: [String], description: '图片 URL 列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: '官网/报名链接' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString()
  seoDesc?: string;

  @ApiPropertyOptional({ description: '是否精选' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ContentStatus, description: '发布状态' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: '发布时间(ISO)，留空则发布时自动取当前' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({ description: '定时发布时间（ISO 字符串），到点自动发布' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
}

export class UpdateTradeShowDto extends PartialType(CreateTradeShowDto) {}
