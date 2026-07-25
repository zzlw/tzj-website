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
  MinLength,
} from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class CreateDocumentDto {
  @ApiProperty({ description: '文档标题' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ description: 'URL slug（留空则根据标题自动生成）' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ description: '所属文件夹 ID' })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional({ description: '正文 Markdown' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: [String], description: '标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '置顶' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: '内部发布时间' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: 'true = 个人文档（仅「文档中心」），false/省略 = 组织内部文档',
  })
  @IsOptional()
  @IsBoolean()
  personal?: boolean;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

/** 文档中心 — 个人文件夹（slug 服务端自动生成） */
export class CreatePersonalDocFolderDto {
  @ApiProperty({ description: '文件夹名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: '父文件夹 ID' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CreateDocTagDto {
  @ApiProperty({ description: '标签名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

export class RenameDocTagDto {
  @ApiProperty({ description: '原标签名' })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ description: '新标签名' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  to!: string;
}

export class MergeDocTagsDto {
  @ApiProperty({ description: '被合并的标签' })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ description: '合并目标标签' })
  @IsString()
  @MinLength(1)
  to!: string;
}

/** 文档中心 — 拖拽排序：某文件夹（folderId 省略/null 表示未分类）内文档的完整有序 ID 列表 */
export class ReorderDocumentsDto {
  @ApiPropertyOptional({ description: '目标文件夹 ID（null/省略 = 未分类）' })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiProperty({ type: [String], description: '按目标顺序排列的文档 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

/** 文档中心 — 移动文档到目标文件夹并落到指定序位 */
export class MoveDocumentDto {
  @ApiPropertyOptional({ description: '目标文件夹 ID（null/省略 = 未分类）' })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional({ description: '目标序位（省略则置于末尾）' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

/** 文档中心 — 拖拽排序：某父级（parentId 省略/null 表示根）下文件夹的完整有序 ID 列表 */
export class ReorderFoldersDto {
  @ApiPropertyOptional({ description: '父文件夹 ID（null/省略 = 根级）' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ type: [String], description: '按目标顺序排列的文件夹 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

/** 文档中心 — 移动文件夹到新父级（置于末尾） */
export class MoveFolderDto {
  @ApiPropertyOptional({ description: '目标父文件夹 ID（null/省略 = 根级）' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
