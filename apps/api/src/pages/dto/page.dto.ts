import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class CreatePageDto {
  @ApiProperty({ description: '页面标题' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'URL slug，全站唯一' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional({ description: '正文（富文本/HTML）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString()
  seoDesc?: string;

  @ApiPropertyOptional({ enum: ContentStatus, description: '状态' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}
