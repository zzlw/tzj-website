import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CollectPageViewDto {
  @ApiProperty({ description: '单次会话 ID（sessionStorage）' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  sessionId!: string;

  @ApiPropertyOptional({ description: '持久匿名访客 ID（localStorage，跨会话归并）' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  visitorId?: string;

  @ApiPropertyOptional({ description: '已识别身份 ID（提交询盘/登录后回写）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @ApiProperty({ example: '/cases/example-slug' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  path!: string;

  @ApiPropertyOptional({ description: '页面标题' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'document.referrer' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @ApiPropertyOptional({ description: 'GPS 纬度（geoMode=gps 且用户授权时）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS 经度（geoMode=gps 且用户授权时）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: '营销来源 utm_source' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmSource?: string;

  @ApiPropertyOptional({ description: '营销媒介 utm_medium' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmMedium?: string;

  @ApiPropertyOptional({ description: '广告系列 utm_campaign' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmCampaign?: string;

  @ApiPropertyOptional({ description: '广告内容 utm_content' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmContent?: string;

  @ApiPropertyOptional({ description: '关键词 utm_term' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmTerm?: string;

  @ApiPropertyOptional({ description: 'Google Ads 点击 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  gclid?: string;

  @ApiPropertyOptional({ description: '百度 OCPC 点击 ID（bd_vid）' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  bdVid?: string;
}
