import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { slugifyTitle } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';

export interface DocFolderTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children: DocFolderTreeNode[];
}

export type DocFolderScope = { ownerId: string | null };

@Injectable()
export class DocFoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(scope: DocFolderScope = { ownerId: null }): Promise<DocFolderTreeNode[]> {
    const rows = await this.prisma.docFolder.findMany({
      where: { ownerId: scope.ownerId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return buildFolderTree(rows);
  }

  async createPersonal(userId: string, dto: { name: string; parentId?: string | null }) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('文件夹名称不能为空');

    if (dto.parentId) {
      const parent = await this.prisma.docFolder.findFirst({
        where: { id: dto.parentId, ownerId: userId },
      });
      if (!parent) throw new NotFoundException('父文件夹不存在');
    }

    const baseSlug = slugifyTitle(name);
    const slug = await ensureUniqueFolderSlug(this.prisma, userId, dto.parentId ?? null, baseSlug);

    return this.prisma.docFolder.create({
      data: {
        name,
        slug,
        parentId: dto.parentId ?? null,
        ownerId: userId,
      },
    });
  }

  async renamePersonal(userId: string, id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('文件夹名称不能为空');

    const existing = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: userId },
    });
    if (!existing) throw new NotFoundException('文件夹不存在');

    const baseSlug = slugifyTitle(trimmed);
    const slug = await ensureUniqueFolderSlug(this.prisma, userId, existing.parentId, baseSlug);

    return this.prisma.docFolder.update({
      where: { id },
      data: { name: trimmed, slug },
    });
  }

  async removePersonal(userId: string, id: string) {
    const existing = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: userId },
    });
    if (!existing) throw new NotFoundException('文件夹不存在');
    await this.prisma.docFolder.delete({ where: { id } });
    return { deleted: true };
  }

  /** 文档中心 — 重排某父级（parentId 省略/null = 根级）下个人文件夹的顺序 */
  async reorderFolders(
    userId: string,
    { parentId, orderedIds }: { parentId?: string | null; orderedIds: string[] },
  ) {
    const targetParentId = parentId ?? null;
    if (!orderedIds.length) return { reordered: 0 };

    // 仅允许操作本人、且位于目标父级下的文件夹
    const folders = await this.prisma.docFolder.findMany({
      where: { id: { in: orderedIds }, ownerId: userId, parentId: targetParentId },
      select: { id: true },
    });
    const allowed = new Set(folders.map((f) => f.id));
    const ids = orderedIds.filter((id) => allowed.has(id));

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.docFolder.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { reordered: ids.length };
  }

  /** 文档中心 — 移动个人文件夹到新父级（置于末尾，禁止移入自身或其后代） */
  async moveFolder(userId: string, id: string, { parentId }: { parentId?: string | null }) {
    const targetParentId = parentId ?? null;

    const folder = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: userId },
    });
    if (!folder) throw new NotFoundException('文件夹不存在');

    if (targetParentId === id) {
      throw new BadRequestException('不能将文件夹移入自身');
    }

    if (targetParentId) {
      const parent = await this.prisma.docFolder.findFirst({
        where: { id: targetParentId, ownerId: userId },
      });
      if (!parent) throw new NotFoundException('父文件夹不存在');

      // 环路防护：目标父级不能是当前文件夹的后代
      const all = await this.prisma.docFolder.findMany({
        where: { ownerId: userId },
        select: { id: true, parentId: true },
      });
      const childrenOf = new Map<string, string[]>();
      for (const f of all) {
        if (!f.parentId) continue;
        const list = childrenOf.get(f.parentId) ?? [];
        list.push(f.id);
        childrenOf.set(f.parentId, list);
      }
      const descendants = new Set<string>();
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop() as string;
        for (const child of childrenOf.get(cur) ?? []) {
          if (!descendants.has(child)) {
            descendants.add(child);
            stack.push(child);
          }
        }
      }
      if (descendants.has(targetParentId)) {
        throw new BadRequestException('不能将文件夹移入其自身的子文件夹');
      }
    }

    // 目标父级下的 slug 唯一性 + 置末尾 sortOrder
    const slug = await ensureUniqueFolderSlug(this.prisma, userId, targetParentId, folder.slug);
    const last = await this.prisma.docFolder.aggregate({
      where: { ownerId: userId, parentId: targetParentId },
      _max: { sortOrder: true },
    });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;

    return this.prisma.docFolder.update({
      where: { id },
      data: { parentId: targetParentId, slug, sortOrder },
    });
  }
}

async function ensureUniqueFolderSlug(
  prisma: PrismaService,
  ownerId: string,
  parentId: string | null,
  base: string,
): Promise<string> {
  const normalized = base.trim() || `folder-${Date.now().toString(36)}`;
  let candidate = normalized.slice(0, 100);
  let suffix = 1;

  for (;;) {
    const existing = await prisma.docFolder.findFirst({
      where: { ownerId, parentId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    const tail = `-${suffix}`;
    candidate = `${normalized.slice(0, Math.max(1, 100 - tail.length))}${tail}`;
  }
}

function buildFolderTree(
  rows: Array<{
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    sortOrder: number;
  }>,
): DocFolderTreeNode[] {
  const map = new Map<string, DocFolderTreeNode>();
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }
  const roots: DocFolderTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (list: DocFolderTreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}
