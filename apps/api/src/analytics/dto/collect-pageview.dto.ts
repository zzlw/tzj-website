import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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
}
