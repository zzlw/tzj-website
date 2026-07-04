/// <reference types="multer" />

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { MediaService } from "./media.service";
import { PresignDto, RegisterMediaDto } from "./dto/media.dto";
import { S3Service } from "../storage/s3.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role } from "../auth/roles";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/roles";

@ApiTags("media")
@ApiBearerAuth()
@Controller("media")
@Roles(Role.EDITOR, Role.ADMIN)
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  @ApiOperation({ summary: "媒体库列表（分页）" })
  findAll(
    @Query("page") page = "1",
    @Query("limit") limit = "24",
    @Query("type") type?: string,
    @Query("folder") folder?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
    @Query("trash") trash?: string,
  ) {
    return this.media.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 24, 100),
      type,
      folder,
      search,
      sortBy,
      sortOrder,
      trash: trash === "1" || trash === "true",
    });
  }

  @Post("upload")
  @UseInterceptors(
    // 需容纳视频/音频等大文件，与 Admin 端 Markdown 编辑器的上限保持一致
    FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "上传文件到媒体库（服务端代理上传）" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        folder: { type: "string", default: "uploads" },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("未接收到文件");
    return this.media.uploadAndRegister(file, folder, user?.id);
  }

  @Post("presign")
  @ApiOperation({ summary: "生成预签名直传 URL（需存储桶 CORS 支持）" })
  async presign(@Body() dto: PresignDto) {
    const key = this.media.buildKey(dto.folder, dto.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, dto.contentType);
    return { uploadUrl, key, publicUrl: this.s3.getUrl(key) };
  }

  @Post()
  @ApiOperation({ summary: "直传完成后登记素材记录" })
  register(@Body() dto: RegisterMediaDto, @CurrentUser() user: AuthUser) {
    return this.media.register(dto, user?.id);
  }

  @RequirePermissions("media.replaceSite")
  @Post(":id/replace-site")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "替换站点静态资源（固定 key 覆盖，旧文件备份至 _archive）" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  async replaceSite(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("未接收到文件");
    return this.media.replaceSiteAsset(id, file, user?.id);
  }

  @RequirePermissions("media.delete")
  @Post(":id/restore")
  @ApiOperation({ summary: "从回收站恢复素材" })
  restore(@Param("id") id: string) {
    return this.media.restore(id);
  }

  @RequirePermissions("media.purge")
  @Delete(":id/purge")
  @ApiOperation({ summary: "永久删除素材（清除存储对象）" })
  purge(@Param("id") id: string) {
    return this.media.purge(id);
  }

  @RequirePermissions("media.delete")
  @Delete(":id")
  @ApiOperation({ summary: "删除素材（软删除，移入回收站）" })
  remove(@Param("id") id: string) {
    return this.media.softRemove(id);
  }
}
