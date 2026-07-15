// ============================================================
// TZJ API — Favicon Controller
// ============================================================
// REST API for favicon management
// POST   /api/v1/site-settings/favicon     — 上传 favicon（自动转 ICO）
// GET    /api/v1/site-settings/favicon     — 获取当前 favicon URL
// DELETE /api/v1/site-settings/favicon     — 删除 favicon
// ============================================================

/// <reference types="multer" />

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles';
import { FaviconService } from './favicon.service';
import type { FaviconUploadResult } from './favicon.service';

/** 允许的 MIME 类型：ICO + 常见图片格式 */
const ALLOWED_MIME_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

@ApiTags('site-settings')
@Controller('site-settings')
export class FaviconController {
  constructor(private readonly faviconService: FaviconService) {}

  // ── 上传 favicon ───────────────────────────────────────────
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('favicon')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
          return cb(new BadRequestException('仅支持 ICO、PNG、JPEG、WebP 格式'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传网站 favicon（图片自动转 ICO）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'ICO / PNG / JPG / WebP 文件',
        },
      },
    },
  })
  async uploadFavicon(@UploadedFile() file: Express.Multer.File): Promise<FaviconUploadResult> {
    if (!file) {
      throw new BadRequestException('未提供文件');
    }
    return this.faviconService.uploadAndConvert(file.buffer, file.mimetype);
  }

  // ── 获取 favicon URL ──────────────────────────────────────
  @Public()
  @Get('favicon')
  @ApiOperation({ summary: '获取当前网站 favicon URL' })
  async getFavicon(): Promise<{ url: string | null; previewUrl?: string | null }> {
    const url = await this.faviconService.getFaviconUrl();
    const previewUrl = await this.faviconService.getFaviconPreviewUrl();
    return { url, previewUrl };
  }

  // ── 删除 favicon ──────────────────────────────────────────
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete('favicon')
  @HttpCode(204)
  @ApiOperation({ summary: '删除网站 favicon' })
  async deleteFavicon(): Promise<void> {
    await this.faviconService.deleteFavicon();
  }
}
