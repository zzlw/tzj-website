import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/** 生成预签名直传 URL 的入参。 */
export class PresignDto {
  @ApiProperty({ description: "原始文件名" })
  @IsString()
  filename!: string;

  @ApiProperty({ description: "文件 MIME 类型，如 image/png" })
  @IsString()
  contentType!: string;

  @ApiPropertyOptional({ description: "子目录，如 products/covers", default: "uploads" })
  @IsOptional()
  @IsString()
  folder?: string;
}

/** 直传完成后登记素材记录的入参。 */
export class RegisterMediaDto {
  @ApiProperty({ description: "S3 对象 key" })
  @IsString()
  key!: string;

  @ApiProperty({ description: "原始文件名" })
  @IsString()
  filename!: string;

  @ApiProperty({ description: "MIME 类型" })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: "文件字节大小" })
  size!: number;

  @ApiPropertyOptional({ description: "子目录", default: "uploads" })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: "替代文本（无障碍/SEO）" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;
}
