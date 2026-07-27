/**
 * 同步 docs/SYSTEM_ANALYSIS.md 到文档中心（个人空间）。
 *
 * 背景：admin 文档中心当前仅有「我的文档」个人空间入口（mine=1），
 * 组织共享文档在界面上无法查看，因此同步到指定用户的个人空间。
 *
 * - 目录：该用户个人顶级目录「技术研发」（slug: tech，不存在则创建）
 * - 文档：slug 固定为 system-analysis，重复执行按仓库文件内容覆盖更新（同步语义）
 * - 状态：published
 *
 * 用法：
 *   pnpm --filter @tzj/api run sync:system-analysis                     # 默认同步到超级管理员
 *   pnpm --filter @tzj/api run sync:system-analysis -- --user <登录邮箱>  # 指定其他用户
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateDocumentSummary } from '../src/common/utils/document-summary';
import { sanitizeMarkdown } from '../src/common/utils/markdown';
import { slugifyTitle } from '../src/common/utils/slug';

const prisma = new PrismaClient();

const SOURCE_FILE = join(__dirname, '../../../docs/SYSTEM_ANALYSIS.md');
const FOLDER_NAME = '技术研发';
const FOLDER_SLUG = 'tech';
const DOC_SLUG = 'system-analysis';
const DOC_TITLE = 'TZJ Monorepo 系统性架构分析';
const DOC_TAGS = ['架构', '技术文档'];
const DEFAULT_OWNER_USERNAME = 'admin@example.com';

function resolveOwnerUsername(): string {
  const idx = process.argv.indexOf('--user');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return DEFAULT_OWNER_USERNAME;
}

async function ensurePersonalFolder(ownerId: string): Promise<string> {
  const existing = await prisma.docFolder.findFirst({
    where: { ownerId, parentId: null, slug: FOLDER_SLUG },
  });
  if (existing) return existing.id;

  const maxSort = await prisma.docFolder.aggregate({
    where: { ownerId, parentId: null },
    _max: { sortOrder: true },
  });
  const created = await prisma.docFolder.create({
    data: {
      ownerId,
      name: FOLDER_NAME,
      slug: FOLDER_SLUG,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  console.log(`已创建个人目录「${FOLDER_NAME}」(${created.id})`);
  return created.id;
}

/** 将标签同步注册到该用户的个人标签表（驱动标签筛选 UI，对齐 DocTagsService.ensureTags 行为） */
async function ensurePersonalTags(ownerId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const exists = await prisma.docTag.findFirst({
      where: { ownerId, name: { equals: name, mode: 'insensitive' } },
    });
    if (exists) continue;
    await prisma.docTag.create({
      data: { ownerId, name, slug: slugifyTitle(name), createdById: ownerId },
    });
  }
}

async function main() {
  const username = resolveOwnerUsername();
  const owner = await prisma.user.findUnique({ where: { username } });
  if (!owner) {
    throw new Error(`用户不存在：${username}（可用 --user <登录邮箱> 指定）`);
  }

  const raw = readFileSync(SOURCE_FILE, 'utf-8');
  const content = sanitizeMarkdown(raw);
  if (!content) {
    throw new Error(`源文件为空：${SOURCE_FILE}`);
  }
  const summary = generateDocumentSummary(content);
  const folderId = await ensurePersonalFolder(owner.id);
  await ensurePersonalTags(owner.id, DOC_TAGS);

  const operator = owner.nickname ?? owner.username;
  const doc = await prisma.internalDocument.upsert({
    where: { slug: DOC_SLUG },
    create: {
      title: DOC_TITLE,
      slug: DOC_SLUG,
      summary,
      content,
      status: 'published',
      tags: DOC_TAGS,
      ownerId: owner.id,
      folderId,
      publishedAt: new Date(),
      createdBy: operator,
      createdById: owner.id,
      lastOperator: operator,
      lastOperatorId: owner.id,
    },
    update: {
      title: DOC_TITLE,
      summary,
      content,
      ownerId: owner.id,
      folderId,
      lastOperator: operator,
      lastOperatorId: owner.id,
    },
  });
  console.log(
    `文档已同步到「${operator}」的个人空间：${doc.title} (slug: ${doc.slug}, status: ${doc.status})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
