// ============================================================
// TZJ API — Storage Controller
// ============================================================
// REST API for file upload / delete / URL generation
// POST   /api/v1/storage/upload      — 上传文件
// DELETE /api/v1/storage/:key        — 删除文件
// GET    /api/v1/storage/url/:key    — 获取访问 URL
// POST   /api/v1/storage/presigned   — 生成预签名 URL
// ============================================================

/// <reference types="multer" />

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { S3Service } from './s3.service';
import type { UploadResult } from './s3.service';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly s3: S3Service) {}

  // ── 上传文件 ─────────────────────────────────────────────
  @RequirePermissions('media.upload')
  @ApiBearerAuth()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文件到 S3/MinIO/OSS' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        directory: {
          type: 'string',
          description: '子目录 (如 products, cases)',
          default: 'uploads',
        },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('directory') directory?: string,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const dir = directory || 'uploads';
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${dir}/${timestamp}-${sanitized}`;

    return this.s3.upload(file.buffer, key, file.mimetype);
  }

  // ── 删除文件 ─────────────────────────────────────────────
  @RequirePermissions('media.delete')
  @ApiBearerAuth()
  @Delete('*key')
  @HttpCode(204)
  @ApiOperation({ summary: '删除存储的文件' })
  async delete(@Param('key') key: string): Promise<void> {
    await this.s3.delete(key);
  }

  // ── 获取公开 URL ─────────────────────────────────────────
  @Public()
  @Get('url/*key')
  @ApiOperation({ summary: '获取文件公开访问 URL' })
  getUrl(@Param('key') key: string): { url: string } {
    return { url: this.s3.getUrl(key) };
  }

  // ── 生成预签名 URL ───────────────────────────────────────
  @RequirePermissions('media.upload')
  @ApiBearerAuth()
  @Post('presigned')
  @ApiOperation({ summary: '生成临时预签名访问 URL' })
  async getPresignedUrl(
    @Body('key') key: string,
    @Body('expiresIn') expiresIn?: number,
  ): Promise<{ url: string; expiresIn: number }> {
    const ttl = expiresIn || 3600;
    const url = await this.s3.getPresignedUrl(key, ttl);
    return { url, expiresIn: ttl };
  }
}
