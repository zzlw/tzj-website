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

export class CreateNewsDto {
  @ApiProperty({ description: '新闻标题' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'URL slug，全站唯一' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;

  @ApiProperty({ description: '分类: company|industry|knowledge|equipment' })
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '正文（Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '详情页宽幅封面图 URL；未设置时 C 端回退封面图' })
  @IsOptional()
  @IsString()
  detailCoverImage?: string;

  @ApiPropertyOptional({ type: [String], description: '图片 URL 列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: '作者' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString()
  seoDesc?: string;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  isTop?: boolean;

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

export class UpdateNewsDto extends PartialType(CreateNewsDto) {}
