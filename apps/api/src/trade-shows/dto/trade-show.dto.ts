import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
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
    description: '类型: exhibition|seminar|roadshow|promotion',
    default: 'exhibition',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '详情页封面图 URL；留空回退封面图' })
  @IsOptional()
  @IsString()
  detailCoverImage?: string;

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

  // ═══ 营销弹窗（docs/activity-system-design.md §4.3）═══

  @ApiPropertyOptional({ description: '启用营销弹窗（展示窗口复用 startDate/endDate）' })
  @IsOptional()
  @IsBoolean()
  isMarketing?: boolean;

  @ApiPropertyOptional({ enum: ['immediate', 'delay', 'scroll'], description: '触发方式' })
  @IsOptional()
  @IsIn(['immediate', 'delay', 'scroll'])
  triggerMode?: string;

  @ApiPropertyOptional({ description: '延时秒数（triggerMode=delay 时生效），1~60' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  delaySeconds?: number;

  @ApiPropertyOptional({ enum: ['session', 'daily', 'once'], description: '频次控制' })
  @IsOptional()
  @IsIn(['session', 'daily', 'once'])
  frequency?: string;

  @ApiPropertyOptional({ type: [String], description: '不展示的路径（不含 locale 前缀）' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\//, { each: true, message: '排除路径必须以 / 开头' })
  excludePages?: string[];

  @ApiPropertyOptional({ enum: ['all', 'mobile', 'desktop'], description: '目标设备' })
  @IsOptional()
  @IsIn(['all', 'mobile', 'desktop'])
  targetDevice?: string;

  @ApiPropertyOptional({ description: 'CTA 按钮文字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaText?: string;

  @ApiPropertyOptional({ description: '弹窗专用头图 URL；留空回退封面图' })
  @IsOptional()
  @IsString()
  popupImage?: string;

  @ApiPropertyOptional({ description: '弹窗专用文案（Markdown）；留空回退详情正文' })
  @IsOptional()
  @IsString()
  popupContent?: string;
}

export class UpdateTradeShowDto extends PartialType(CreateTradeShowDto) {}
