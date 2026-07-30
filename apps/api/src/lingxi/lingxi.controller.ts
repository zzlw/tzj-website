import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUser } from '../auth/roles';
import { ChatRequestDto } from './dto/chat.dto';
import { ListConversationsQueryDto } from './dto/conversation.dto';
import { LingxiAgentService } from './lingxi-agent.service';

@ApiTags('lingxi')
@ApiBearerAuth()
@Controller('lingxi')
export class LingxiController {
  constructor(private readonly agent: LingxiAgentService) {}

  @RequirePermissions('lingxi.use')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  @ApiOperation({ summary: '发起灵犀生成（SSE 流式响应）；未配置 LLM Key 时返回 503' })
  async chat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    // @Res() 手写 SSE，绕过 TransformInterceptor 的统一包装
    await this.agent.chat(user, dto, res);
  }

  @RequirePermissions('lingxi.use')
  @Get('chat/stream/:conversationId')
  @ApiOperation({ summary: '流恢复：重放缓冲帧并续播（M4 接入 RunBuffer 后可用）' })
  resumeStream(@Param('conversationId') _conversationId: string): never {
    throw new NotFoundException('该会话没有进行中的生成');
  }

  @RequirePermissions('lingxi.use')
  @Get('conversations')
  @ApiOperation({ summary: '会话列表（仅本人，分页）' })
  listConversations(@Query() query: ListConversationsQueryDto, @CurrentUser() user: AuthUser) {
    return this.agent.listConversations(user.id, query.page ?? 1, query.pageSize ?? 20);
  }

  @RequirePermissions('lingxi.use')
  @Get('conversations/:id')
  @ApiOperation({ summary: '会话详情（历史消息 + generating 标志）' })
  getConversation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agent.getConversation(user.id, id);
  }

  @RequirePermissions('lingxi.use')
  @Delete('conversations/:id')
  @ApiOperation({ summary: '删除会话（软删除，30 天后随清理任务物理删除）' })
  deleteConversation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agent.softDeleteConversation(user.id, id);
  }
}
