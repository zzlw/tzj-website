import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * 全局 ValidationPipe 为 whitelist: false（未知字段不剥离），
 * 本 DTO 须自带严格校验，不依赖全局配置。
 */
export class ChatRequestDto {
  @ApiPropertyOptional({ description: '续聊的会话 ID（cuid）；缺省时新建会话' })
  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{20,32}$/, { message: 'conversationId 格式不正确' })
  conversationId?: string;

  @ApiProperty({ description: '用户输入（一句话需求），最长 2000 字符' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
