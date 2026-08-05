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

export class CreateCaseDto {
  @ApiProperty({ description: '案例标题' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'URL slug，全站唯一' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;

  @ApiProperty({
    description: '案例类型: military|fire|police|scenic|school|enterprise',
  })
  @IsString()
  @MinLength(1)
  caseType!: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '详情（Markdown）' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '详情页宽幅封面图 URL（未设置时回退封面图）' })
  @IsOptional()
  @IsString()
  detailCoverImage?: string;

  @ApiPropertyOptional({ type: [String], description: '图片 URL 列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: '项目地点' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '客户/单位' })
  @IsOptional()
  @IsString()
  client?: string;

  @ApiPropertyOptional({ type: [String], description: '项目亮点列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({
    description: '项目参数表',
    example: [{ label: '塔型', value: '固定训练塔' }],
  })
  @IsOptional()
  @IsArray()
  specs?: { label: string; value: string }[];

  @ApiPropertyOptional({ description: '发布日期（ISO），前台列表按此倒序排列' })
  @IsOptional()
  @IsDateString()
  completionDate?: string | null;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString()
  seoDesc?: string;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否推荐' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: ContentStatus, description: '发布状态' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: '定时发布时间（ISO 字符串），到点自动发布' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
}

export class UpdateCaseDto extends PartialType(CreateCaseDto) {}
