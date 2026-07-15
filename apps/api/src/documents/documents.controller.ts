import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { roleHasPermission } from '../access/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUser } from '../auth/roles';
import { DocFoldersService } from './doc-folders.service';
import { DocTagsService } from './doc-tags.service';
import { DocumentsService } from './documents.service';
import {
  CreateDocTagDto,
  CreateDocumentDto,
  CreatePersonalDocFolderDto,
  MergeDocTagsDto,
  RenameDocTagDto,
  UpdateDocumentDto,
} from './dto/document.dto';
import { BatchUpdatePermissionsDto, CreateDocumentPermissionDto, PermissionRole, PermissionTargetType } from './dto/document-permission.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly foldersService: DocFoldersService,
    private readonly tagsService: DocTagsService,
  ) {}

  private canManage(user: AuthUser): boolean {
    const perms = user.permissions;
    if (perms?.length) {
      return perms.includes('docs.manage');
    }
    return roleHasPermission(user.role, 'docs.manage');
  }

  @RequirePermissions('docs.view')
  @Get('folders/tree')
  @ApiOperation({ summary: '文件夹树' })
  @ApiQuery({ name: 'scope', required: false, enum: ['shared', 'mine'] })
  getFolderTree(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    if (scope === 'mine') {
      return this.foldersService.getTree({ ownerId: user.id });
    }
    return this.foldersService.getTree({ ownerId: null });
  }

  @RequirePermissions('docs.create')
  @Post('folders/personal')
  @ApiOperation({ summary: '创建个人文件夹（文档中心）' })
  createPersonalFolder(@Body() dto: CreatePersonalDocFolderDto, @CurrentUser() user: AuthUser) {
    return this.foldersService.createPersonal(user.id, dto);
  }

  @RequirePermissions('docs.create')
  @Delete('folders/personal/:id')
  @ApiOperation({ summary: '删除个人文件夹（文档中心）' })
  removePersonalFolder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.foldersService.removePersonal(user.id, id);
  }

  @RequirePermissions('docs.create')
  @Patch('folders/personal/:id')
  @ApiOperation({ summary: '重命名个人文件夹（文档中心）' })
  renamePersonalFolder(
    @Param('id') id: string,
    @Body() dto: { name: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.foldersService.renamePersonal(user.id, id, dto.name);
  }

  @RequirePermissions('docs.view')
  @Get()
  @ApiOperation({ summary: '文档列表' })
  @ApiQuery({ name: 'folderId', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['published', 'draft'] })
  @ApiQuery({ name: 'mine', required: false, description: '仅当前用户的个人文档（ownerId）' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('folderId') folderId?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
  ) {
    const mineOnly = mine === '1' || mine === 'true';
    return this.documentsService.findAll({
      page,
      limit,
      folderId,
      tag,
      search,
      sortBy,
      sortOrder,
      status,
      includeDrafts: this.canSeeDrafts(user),
      mine: mineOnly,
      userId: mineOnly ? user.id : undefined,
    });
  }

  @RequirePermissions('docs.view')
  @Get('tags')
  @ApiOperation({ summary: '标签列表（含文档数，用于筛选）' })
  @ApiQuery({ name: 'mine', required: false })
  listTags(@CurrentUser() user: AuthUser, @Query('mine') mine?: string) {
    return this.tagsService.listTags(this.tagScope(user, mine));
  }

  @RequirePermissions('docs.create')
  @Post('tags')
  @ApiOperation({ summary: '新建标签（注册到标签库）' })
  @ApiQuery({ name: 'mine', required: false })
  createTag(
    @Body() dto: CreateDocTagDto,
    @CurrentUser() user: AuthUser,
    @Query('mine') mine?: string,
  ) {
    return this.tagsService.createTag(dto.name, user.id, this.tagScope(user, mine));
  }

  @RequirePermissions('docs.manage')
  @Put('tags/rename')
  @ApiOperation({ summary: '重命名标签（同步更新所有文档）' })
  @ApiQuery({ name: 'mine', required: false })
  renameTag(
    @Body() dto: RenameDocTagDto,
    @CurrentUser() user: AuthUser,
    @Query('mine') mine?: string,
  ) {
    return this.tagsService.renameTag(dto.from, dto.to, this.tagScope(user, mine));
  }

  @RequirePermissions('docs.manage')
  @Post('tags/merge')
  @ApiOperation({ summary: '合并标签' })
  @ApiQuery({ name: 'mine', required: false })
  mergeTags(
    @Body() dto: MergeDocTagsDto,
    @CurrentUser() user: AuthUser,
    @Query('mine') mine?: string,
  ) {
    return this.tagsService.mergeTags(dto.from, dto.to, this.tagScope(user, mine));
  }

  @RequirePermissions('docs.manage')
  @Delete('tags/:slug')
  @ApiOperation({ summary: '删除标签（从所有文档移除）' })
  @ApiQuery({ name: 'mine', required: false })
  @ApiQuery({ name: 'name', required: false, description: '按名称删除（slug 与中文名不一致时）' })
  deleteTag(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Query('mine') mine?: string,
    @Query('name') name?: string,
  ) {
    const tagName = name ?? slug;
    return this.tagsService.deleteTag(tagName, this.tagScope(user, mine));
  }

  @RequirePermissions('docs.view')
  @Get(':id/revisions')
  @ApiOperation({ summary: '文档版本历史' })
  listRevisions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.listRevisions(id, user.id, this.canManage(user));
  }

  @RequirePermissions('docs.edit')
  @Post(':id/revisions/:revisionId/restore')
  @ApiOperation({ summary: '恢复到指定历史版本' })
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.restoreRevision(id, revisionId, user.id, this.canManage(user));
  }

  @RequirePermissions('docs.view')
  @Get(':id')
  @ApiOperation({ summary: '文档详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.findOne(id, {
      includeDrafts: this.canSeeDrafts(user),
      viewerId: user.id,
      canManage: this.canManage(user),
    });
  }

  @RequirePermissions('docs.create')
  @Post()
  @ApiOperation({ summary: '创建文档' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser) {
    return this.documentsService.create(dto, user.id);
  }

  @RequirePermissions('docs.edit')
  @Put(':id')
  @ApiOperation({ summary: '更新文档' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: AuthUser) {
    return this.documentsService.update(id, dto, user.id, this.canManage(user));
  }

  @RequirePermissions('docs.delete')
  @Delete(':id')
  @ApiOperation({ summary: '删除文档' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.remove(id, user.id, this.canManage(user));
  }

  // ==================== 权限管理 API ====================

  @RequirePermissions('docs.view')
  @Get(':id/permissions')
  @ApiOperation({ summary: '获取文档权限列表' })
  getPermissions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.getPermissions(id, user.id, this.canManage(user));
  }

  @RequirePermissions('docs.edit')
  @Put(':id/permissions')
  @ApiOperation({ summary: '更新文档权限（批量替换）' })
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: BatchUpdatePermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.updatePermissions(
      id,
      dto.permissions,
      user.id,
      this.canManage(user),
    );
  }

  @RequirePermissions('docs.edit')
  @Post(':id/permissions')
  @ApiOperation({ summary: '添加单个权限' })
  addPermission(
    @Param('id') id: string,
    @Body() dto: CreateDocumentPermissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.addPermission(id, dto, user.id, this.canManage(user));
  }

  @RequirePermissions('docs.edit')
  @Delete(':id/permissions/:permissionId')
  @ApiOperation({ summary: '删除权限' })
  removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.removePermission(id, permissionId, user.id, this.canManage(user));
  }

  private tagScope(user: AuthUser, mine?: string) {
    const mineOnly = mine === '1' || mine === 'true';
    return {
      mine: mineOnly,
      userId: mineOnly ? user.id : undefined,
      includeDrafts: this.canSeeDrafts(user),
    };
  }

  private canSeeDrafts(user: AuthUser): boolean {
    const perms = user.permissions;
    if (perms?.length) {
      return (
        perms.includes('docs.edit') ||
        perms.includes('docs.create') ||
        perms.includes('docs.manage')
      );
    }
    return (
      roleHasPermission(user.role, 'docs.edit') ||
      roleHasPermission(user.role, 'docs.create') ||
      roleHasPermission(user.role, 'docs.manage')
    );
  }
}
