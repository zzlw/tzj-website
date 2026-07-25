import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PreviewTokenDto } from './dto/preview-token.dto';
import { PreviewTokenService } from './preview-token.service';

@ApiTags('preview')
@Controller('preview-tokens')
export class PreviewController {
  constructor(private readonly previewTokens: PreviewTokenService) {}

  @RequirePermissions('content.create', 'content.edit')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '签发草稿预览令牌（30 分钟有效，绑定资源与 slug）' })
  async create(@Body() dto: PreviewTokenDto) {
    return { token: await this.previewTokens.sign(dto.resource, dto.slug) };
  }
}
