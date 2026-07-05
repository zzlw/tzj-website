import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { slugifyTitle } from "../common/utils/slug";

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
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return buildFolderTree(rows);
  }

  async create(dto: {
    name: string;
    slug: string;
    parentId?: string | null;
    sortOrder?: number;
  }) {
    if (dto.parentId) {
      const parent = await this.prisma.docFolder.findFirst({
        where: { id: dto.parentId, ownerId: null },
      });
      if (!parent) throw new NotFoundException("父文件夹不存在");
    }
    return this.prisma.docFolder.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        ownerId: null,
      },
    });
  }

  async createPersonal(
    userId: string,
    dto: { name: string; parentId?: string | null },
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("文件夹名称不能为空");

    if (dto.parentId) {
      const parent = await this.prisma.docFolder.findFirst({
        where: { id: dto.parentId, ownerId: userId },
      });
      if (!parent) throw new NotFoundException("父文件夹不存在");
    }

    const baseSlug = slugifyTitle(name);
    const slug = await ensureUniqueFolderSlug(
      this.prisma,
      userId,
      dto.parentId ?? null,
      baseSlug,
    );

    return this.prisma.docFolder.create({
      data: {
        name,
        slug,
        parentId: dto.parentId ?? null,
        ownerId: userId,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      slug: string;
      parentId: string | null;
      sortOrder: number;
    }>,
  ) {
    const existing = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: null },
    });
    if (!existing) throw new NotFoundException("文件夹不存在");

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("文件夹不能移动到自身下");
      }
      const parent = await this.prisma.docFolder.findFirst({
        where: { id: dto.parentId, ownerId: null },
      });
      if (!parent) throw new NotFoundException("父文件夹不存在");
    }

    return this.prisma.docFolder.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.slug?.trim(),
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: null },
    });
    if (!existing) throw new NotFoundException("文件夹不存在");
    await this.prisma.docFolder.delete({ where: { id } });
    return { deleted: true };
  }

  async removePersonal(userId: string, id: string) {
    const existing = await this.prisma.docFolder.findFirst({
      where: { id, ownerId: userId },
    });
    if (!existing) throw new NotFoundException("文件夹不存在");
    await this.prisma.docFolder.delete({ where: { id } });
    return { deleted: true };
  }

  /** 预置四大业务空间（seed） */
  async seedDefaultFolders(): Promise<void> {
    const defaults = [
      { slug: "sales", name: "销售与市场", sortOrder: 0 },
      { slug: "engineering", name: "工程与产品", sortOrder: 1 },
      { slug: "operations", name: "运营与售后", sortOrder: 2 },
      { slug: "administration", name: "管理与制度", sortOrder: 3 },
    ];
    for (const item of defaults) {
      const existing = await this.prisma.docFolder.findFirst({
        where: { slug: item.slug, parentId: null, ownerId: null },
      });
      if (existing) {
        await this.prisma.docFolder.update({
          where: { id: existing.id },
          data: { name: item.name, sortOrder: item.sortOrder },
        });
      } else {
        await this.prisma.docFolder.create({
          data: { ...item, parentId: null, ownerId: null },
        });
      }
    }
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
    list.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}
