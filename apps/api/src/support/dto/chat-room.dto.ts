import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum ChatRoomStatus {
  ACTIVE = 'active',
  WAITING = 'waiting',
  CLOSED = 'closed',
}

export class CreateChatRoomDto {
  @IsNotEmpty()
  @IsEmail()
  clientEmail!: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  initialMessage?: string;

  // 访客上下文（由 C 端上报，服务端据此 enrichment；IP 由服务端从请求中提取，不信任客户端）
  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  landingPath?: string;

  /** UTM source / 渠道来源 */
  @IsOptional()
  @IsString()
  source?: string;

  /** 分析访客 ID（_tzj_vid），用于 B 端按人查聊天历史 */
  @IsOptional()
  @IsString()
  visitorId?: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(['client', 'agent'])
  sender!: 'client' | 'agent';

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class PresignAttachmentDto {
  @IsNotEmpty()
  @IsString()
  fileName!: string;

  @IsNotEmpty()
  @IsString()
  contentType!: string;

  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  size!: number;

  @IsNotEmpty()
  @IsEmail()
  senderEmail!: string;
}

export class UpdateChatRoomDto {
  @IsOptional()
  @IsEnum(ChatRoomStatus)
  status?: ChatRoomStatus;

  @IsOptional()
  @IsEmail()
  assignedAgentEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

/** 访客重连换 token：凭 roomId + clientEmail（须匹配房间持有者）换取短期 chat token。 */
export class VisitorTokenDto {
  @IsNotEmpty()
  @IsString()
  roomId!: string;

  @IsNotEmpty()
  @IsEmail()
  clientEmail!: string;
}

/** 转接：把会话重新分配给另一名坐席（仅坐席可操作）。 */
export class TransferRoomDto {
  @IsNotEmpty()
  @IsString()
  toAgentEmail!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class GetChatRoomsDto {
  // 状态过滤：单一值或逗号分隔多值（如 "closed,archived"）。
  // 省略则查所有未删除会话（不含 archived 由前端按需指定）。
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  assignedAgentEmail?: string;

  /** 服务端搜索：匹配 clientName / clientEmail（业内最佳实践：避免把搜索下放前端） */
  @IsOptional()
  @IsString()
  search?: string;

  /** 游标分页：上一页最后一项的 (lastActivity, id) 编码；首屏留空 */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** 每页数量（默认 20，最大 100） */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  take?: number;

  /** 按分析访客 ID 筛选（访客档案抽屉用） */
  @IsOptional()
  @IsString()
  visitorId?: string;
}

/** 批量操作（关闭 / 归档 / 软删除） */
export class BatchChatRoomsDto {
  @IsEnum(['close', 'archive', 'delete'])
  action!: 'close' | 'archive' | 'delete';

  @IsArray()
  @IsString({ each: true })
  roomIds!: string[];
}
