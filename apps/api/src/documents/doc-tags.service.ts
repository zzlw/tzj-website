import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { ContentStatus } from '../common/enums/content-status.enum';
import { slugifyTitle } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';

export interface DocTagScope {
  mine?: boolean;
  userId?: string;
  includeDrafts?: boolean;
}

export interface DocTagListItem {
  id: string;
  tag: string;
  slug: string;
  count: number;
}

@Injectable()
export class DocTagsService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeOwnerId(scope: DocTagScope): string | null {
    return scope.mine && scope.userId ? scope.userId : null;
  }

  private documentScopeWhere(scope: DocTagScope): Prisma.InternalDocumentWhereInput {
    const where: Prisma.InternalDocumentWhereInput = {};
    if (scope.mine && scope.userId) {
      where.ownerId = scope.userId;
    } else {
      where.ownerId = null;
      if (!scope.includeDrafts) {
        where.status = ContentStatus.PUBLISHED;
      }
    }
    return where;
  }

  private normalizeName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new BadRequestException('标签名称不能为空');
    if (trimmed.length > 50) {
      throw new BadRequestException('标签名称不能超过 50 个字符');
    }
    return trimmed;
  }

  private async ensureUniqueSlug(
    ownerId: string | null,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base.slice(0, 100) || `tag-${Date.now().toString(36)}`;
    let suffix = 1;
    for (;;) {
      const existing = await this.prisma.docTag.findFirst({
        where: {
          ownerId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      suffix += 1;
      const tail = `-${suffix}`;
      candidate = `${base.slice(0, Math.max(1, 100 - tail.length))}${tail}`;
    }
  }

  /** 从已有文档回填标签注册表（一次性） */
  async syncLegacyTags() {
    const existing = await this.prisma.docTag.count();
    if (existing > 0) return;

    const docs = await this.prisma.internalDocument.findMany({
      select: { ownerId: true, tags: true },
    });

    const seen = new Set<string>();
    for (const doc of docs) {
      const ownerId = doc.ownerId;
      for (const raw of doc.tags) {
        const name = raw.trim();
        if (!name) continue;
        const key = `${ownerId ?? 'org'}:${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const slug = await this.ensureUniqueSlug(ownerId, slugifyTitle(name) || `tag-${seen.size}`);
        await this.prisma.docTag.create({
          data: { ownerId, name, slug },
        });
      }
    }
  }

  private async countTagUsage(
    ownerId: string | null,
    tagName: string,
    scope: DocTagScope,
  ): Promise<number> {
    return this.prisma.internalDocument.count({
      where: {
        ...this.documentScopeWhere(scope),
        ownerId,
        tags: { has: tagName },
      },
    });
  }

  async listTags(scope: DocTagScope): Promise<DocTagListItem[]> {
    await this.syncLegacyTags();
    const ownerId = this.scopeOwnerId(scope);

    const registry = await this.prisma.docTag.findMany({
      where: { ownerId },
      orderBy: { name: 'asc' },
    });

    const items: DocTagListItem[] = [];
    for (const row of registry) {
      const count = await this.countTagUsage(ownerId, row.name, scope);
      items.push({
        id: row.id,
        tag: row.name,
        slug: row.slug,
        count,
      });
    }

    return items.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
  }

  async createTag(name: string, actorId: string, scope: DocTagScope) {
    const normalized = this.normalizeName(name);
    const ownerId = this.scopeOwnerId(scope);
    const slug = await this.ensureUniqueSlug(ownerId, slugifyTitle(normalized));

    const dup = await this.prisma.docTag.findFirst({
      where: {
        ownerId,
        name: { equals: normalized, mode: 'insensitive' },
      },
    });
    if (dup) {
      throw new ConflictException(`标签「${normalized}」已存在`);
    }

    return this.prisma.docTag.create({
      data: {
        ownerId,
        name: normalized,
        slug,
        createdById: actorId,
      },
    });
  }

  /** 文档保存时确保标签已注册 */
  async ensureTags(tagNames: string[], scope: DocTagScope, actorId?: string) {
    const ownerId = this.scopeOwnerId(scope);
    for (const raw of tagNames) {
      const name = raw.trim();
      if (!name) continue;
      const exists = await this.prisma.docTag.findFirst({
        where: {
          ownerId,
          name: { equals: name, mode: 'insensitive' },
        },
      });
      if (exists) continue;
      const slug = await this.ensureUniqueSlug(ownerId, slugifyTitle(name));
      await this.prisma.docTag.create({
        data: {
          ownerId,
          name,
          slug,
          createdById: actorId ?? null,
        },
      });
    }
  }

  async renameTag(from: string, to: string, scope: DocTagScope) {
    const ownerId = this.scopeOwnerId(scope);
    const oldName = this.normalizeName(from);
    const newName = this.normalizeName(to);
    if (oldName.toLowerCase() === newName.toLowerCase()) {
      throw new BadRequestException('新名称与原名相同');
    }

    const row = await this.prisma.docTag.findFirst({
      where: { ownerId, name: { equals: oldName, mode: 'insensitive' } },
    });
    if (!row) throw new NotFoundException(`标签「${oldName}」不存在`);

    const conflict = await this.prisma.docTag.findFirst({
      where: {
        ownerId,
        name: { equals: newName, mode: 'insensitive' },
        id: { not: row.id },
      },
    });
    if (conflict) {
      throw new ConflictException(`标签「${newName}」已存在，请使用合并`);
    }

    const newSlug = await this.ensureUniqueSlug(ownerId, slugifyTitle(newName), row.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.docTag.update({
        where: { id: row.id },
        data: { name: newName, slug: newSlug },
      });
      const docs = await tx.internalDocument.findMany({
        where: { ownerId, tags: { has: row.name } },
        select: { id: true, tags: true },
      });
      for (const doc of docs) {
        const tags = [...new Set(doc.tags.map((t) => (t === row.name ? newName : t)))];
        await tx.internalDocument.update({
          where: { id: doc.id },
          data: { tags },
        });
      }
    });

    return { renamed: true, from: oldName, to: newName };
  }

  async mergeTags(from: string, to: string, scope: DocTagScope) {
    const ownerId = this.scopeOwnerId(scope);
    const fromName = this.normalizeName(from);
    const toName = this.normalizeName(to);
    if (fromName.toLowerCase() === toName.toLowerCase()) {
      throw new BadRequestException('合并源与目标不能相同');
    }

    const source = await this.prisma.docTag.findFirst({
      where: { ownerId, name: { equals: fromName, mode: 'insensitive' } },
    });
    let target = await this.prisma.docTag.findFirst({
      where: { ownerId, name: { equals: toName, mode: 'insensitive' } },
    });

    if (!target) {
      const slug = await this.ensureUniqueSlug(ownerId, slugifyTitle(toName));
      target = await this.prisma.docTag.create({
        data: { ownerId, name: toName, slug },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const docs = await tx.internalDocument.findMany({
        where: { ownerId, tags: { has: fromName } },
        select: { id: true, tags: true },
      });
      for (const doc of docs) {
        const tags = [
          ...new Set(
            doc.tags.map((t) => (t === fromName ? target!.name : t)).filter((t) => t !== fromName),
          ),
        ];
        if (!tags.includes(target!.name)) tags.push(target!.name);
        await tx.internalDocument.update({
          where: { id: doc.id },
          data: { tags },
        });
      }
      if (source) {
        await tx.docTag.delete({ where: { id: source.id } });
      }
    });

    return { merged: true, from: fromName, to: target.name };
  }

  async deleteTag(name: string, scope: DocTagScope) {
    const ownerId = this.scopeOwnerId(scope);
    const tagName = this.normalizeName(name);

    const row = await this.prisma.docTag.findFirst({
      where: { ownerId, name: { equals: tagName, mode: 'insensitive' } },
    });
    if (!row) throw new NotFoundException(`标签「${tagName}」不存在`);

    await this.prisma.$transaction(async (tx) => {
      const docs = await tx.internalDocument.findMany({
        where: { ownerId, tags: { has: row.name } },
        select: { id: true, tags: true },
      });
      for (const doc of docs) {
        await tx.internalDocument.update({
          where: { id: doc.id },
          data: { tags: doc.tags.filter((t) => t !== row.name) },
        });
      }
      await tx.docTag.delete({ where: { id: row.id } });
    });

    return { deleted: true, tag: tagName };
  }
}
