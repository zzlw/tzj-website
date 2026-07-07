import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ContentStatus } from "../../common/enums/content-status.enum";

export class CreateDocumentDto {
  @ApiProperty({ description: "文档标题" })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ description: "URL slug（留空则根据标题自动生成）" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ description: "所属文件夹 ID" })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional({ description: "正文 Markdown" })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: [String], description: "标签" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: "置顶" })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: "内部发布时间" })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: "true = 个人文档（仅「我的文档」），false/省略 = 组织内部文档",
  })
  @IsOptional()
  @IsBoolean()
  personal?: boolean;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

/** 我的文档 — 个人文件夹（slug 服务端自动生成） */
export class CreatePersonalDocFolderDto {
  @ApiProperty({ description: "文件夹名称" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: "父文件夹 ID" })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CreateDocTagDto {
  @ApiProperty({ description: "标签名称" })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

export class RenameDocTagDto {
  @ApiProperty({ description: "原标签名" })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ description: "新标签名" })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  to!: string;
}

export class MergeDocTagsDto {
  @ApiProperty({ description: "被合并的标签" })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ description: "合并目标标签" })
  @IsString()
  @MinLength(1)
  to!: string;
}
