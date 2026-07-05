import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CollectPageViewDto {
  @ApiProperty({ description: "匿名访客会话 ID（localStorage）" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  sessionId!: string;

  @ApiProperty({ example: "/cases/example-slug" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  path!: string;

  @ApiPropertyOptional({ description: "页面标题" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: "document.referrer" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @ApiPropertyOptional({ description: "GPS 纬度（geoMode=gps 且用户授权时）" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: "GPS 经度（geoMode=gps 且用户授权时）" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
