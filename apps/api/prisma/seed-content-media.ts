/**
 * 将 apps/web/public 下的站点静态资源（/media/*、og、favicon 等）上传至 MinIO，
 * 并更新 CMS 内容表中的 coverImage / images 为 MinIO URL。
 *
 * 用法：
 *   pnpm --filter @tzj/api prisma:sync:static-media
 *   pnpm --filter @tzj/api prisma:sync:static-media -- --force
 *   pnpm --filter @tzj/api prisma:sync:static-media -- --force --keys=hero.mp4,og-default.jpg
 */
import { PrismaClient } from '@prisma/client';
import {
  patchContentImageUrls,
  type SyncSiteStaticMediaOptions,
  syncSiteStaticMedia,
} from './lib/sync-content-media';

function parseCliOptions(): SyncSiteStaticMediaOptions {
  const opts: SyncSiteStaticMediaOptions = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--keys=')) {
      opts.keys = arg
        .slice('--keys='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return opts;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const options = parseCliOptions();
  const urlMap = await syncSiteStaticMedia(prisma, options);
  await patchContentImageUrls(prisma, urlMap);
  console.log(`\n✅ 已迁移 ${urlMap.size} 个静态资源到 MinIO，并更新 CMS 内容 URL`);
}

main()
  .catch((e: unknown) => {
    console.error('❌ 静态资源迁移 MinIO 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
