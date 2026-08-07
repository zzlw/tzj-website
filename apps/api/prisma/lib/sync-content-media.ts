import * as fs from 'node:fs';
import * as path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';
import {
  collectSiteStaticMediaPaths,
  TRADE_SHOW_COVERS,
} from '../../../web/src/lib/static-media-paths';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
};

interface S3Config {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicDomain: string;
}

function loadS3Config(): S3Config {
  return {
    bucket: process.env.S3_BUCKET || 'tzj-uploads-dev',
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_ACCESS_KEY_SECRET || 'minioadmin',
    publicDomain: process.env.S3_PUBLIC_DOMAIN || 'http://localhost:9000/tzj-uploads-dev',
  };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function isWebStaticPath(url: string): boolean {
  return (
    url.startsWith('/media/') ||
    url.startsWith('/og-') ||
    url === '/favicon.ico' ||
    url === '/apple-touch-icon.png'
  );
}

function toMinioPublicUrl(webPath: string, publicDomain: string): string {
  const base = publicDomain.replace(/\/$/, '');
  if (webPath.startsWith('/media/')) {
    return `${base}/content/${webPath.slice('/media/'.length)}`;
  }
  const filename = webPath.startsWith('/') ? webPath.slice(1) : webPath;
  if (filename && !filename.includes('/')) {
    return `${base}/content/${filename}`;
  }
  return webPath;
}

function localPathFor(webPath: string): string {
  const root = path.resolve(__dirname, '../../../web/public');
  return path.join(root, webPath.replace(/^\//, ''));
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

async function uploadIfNeeded(
  client: S3Client,
  config: S3Config,
  localPath: string,
  key: string,
  force = false,
): Promise<string> {
  const url = `${config.publicDomain.replace(/\/$/, '')}/${key}`;
  if (!force) {
    try {
      await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      return url;
    } catch {
      // 对象不存在，继续上传
    }
  }

  const buffer = fs.readFileSync(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: getMimeType(localPath),
    }),
  );
  return url;
}

/** @deprecated 请使用 collectSiteStaticMediaPaths */
export function collectContentImagePaths(
  _tradeShowCovers: readonly string[] = TRADE_SHOW_COVERS,
): string[] {
  return collectSiteStaticMediaPaths();
}

export { TRADE_SHOW_COVERS };

export interface SyncSiteStaticMediaOptions {
  /** 已存在时仍从本地重新上传覆盖 MinIO 对象 */
  force?: boolean;
  /** 仅同步指定文件名（如 hero.mp4），不含 content/ 前缀 */
  keys?: string[];
}

/** 将 Web 静态资源从 public/ 上传至 MinIO 并登记 media_assets。 */
export async function syncSiteStaticMedia(
  prisma: PrismaClient,
  options: SyncSiteStaticMediaOptions = {},
): Promise<Map<string, string>> {
  const config = loadS3Config();
  const client = createS3Client(config);
  let paths = collectSiteStaticMediaPaths();
  if (options.keys?.length) {
    const names = new Set(
      options.keys.map((k) => k.replace(/^content\//, '').trim()).filter(Boolean),
    );
    paths = paths.filter((p) => names.has(path.basename(p)));
  }
  const map = new Map<string, string>();

  console.log(
    `\n🖼️  同步站点静态资源到 MinIO（${paths.length} 个文件${options.force ? '，强制覆盖' : ''}）…`,
  );

  for (const webPath of paths) {
    const localPath = localPathFor(webPath);
    if (!fs.existsSync(localPath)) {
      console.warn(`   ⚠️  本地文件不存在，跳过: ${webPath}`);
      continue;
    }

    const filename = path.basename(webPath);
    const key = `content/${filename}`;
    const url = await uploadIfNeeded(client, config, localPath, key, options.force);
    const stat = fs.statSync(localPath);

    await prisma.mediaAsset.upsert({
      where: { key },
      create: {
        key,
        url,
        filename,
        mimeType: getMimeType(localPath),
        size: stat.size,
        folder: 'content',
      },
      update: { url, size: stat.size, mimeType: getMimeType(localPath) },
    });

    map.set(webPath, url);
    console.log(`   ✅ ${filename}`);
  }

  return map;
}

/** @deprecated 请使用 syncSiteStaticMedia */
export const syncContentMedia = syncSiteStaticMedia;

/** 将相对路径解析为 MinIO URL；已是绝对 URL 则原样返回。 */
export function resolveContentUrl(
  value: string | null | undefined,
  map: Map<string, string>,
  publicDomain = process.env.S3_PUBLIC_DOMAIN || 'http://localhost:9000/tzj-uploads-dev',
): string | undefined {
  if (!value?.trim()) return undefined;
  const src = value.trim();
  if (/^https?:\/\//i.test(src)) return src;
  if (map.has(src)) return map.get(src);
  if (isWebStaticPath(src)) return toMinioPublicUrl(src, publicDomain);
  return src;
}

function resolveImages(values: string[] | null | undefined, map: Map<string, string>): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => resolveContentUrl(v, map)).filter((v): v is string => Boolean(v));
}

/** 将数据库中已有内容的 coverImage / images 更新为媒体库 URL。 */
export async function patchContentImageUrls(
  prisma: PrismaClient,
  map: Map<string, string>,
): Promise<void> {
  const [cases, news, blogs, tradeShows] = await Promise.all([
    prisma.case.findMany({ select: { id: true, coverImage: true, images: true } }),
    prisma.news.findMany({ select: { id: true, coverImage: true, images: true } }),
    prisma.blog.findMany({
      select: { id: true, coverImage: true, detailCoverImage: true, images: true },
    }),
    prisma.tradeShow.findMany({
      select: { id: true, coverImage: true, detailCoverImage: true, images: true },
    }),
  ]);

  await Promise.all([
    ...cases.map((row) =>
      prisma.case.update({
        where: { id: row.id },
        data: {
          coverImage: resolveContentUrl(row.coverImage, map),
          images: resolveImages(row.images, map),
        },
      }),
    ),
    ...news.map((row) =>
      prisma.news.update({
        where: { id: row.id },
        data: {
          coverImage: resolveContentUrl(row.coverImage, map),
          images: resolveImages(row.images, map),
        },
      }),
    ),
    ...blogs.map((row) =>
      prisma.blog.update({
        where: { id: row.id },
        data: {
          coverImage: resolveContentUrl(row.coverImage, map),
          detailCoverImage: resolveContentUrl(row.detailCoverImage, map),
          images: resolveImages(row.images, map),
        },
      }),
    ),
    ...tradeShows.map((row) =>
      prisma.tradeShow.update({
        where: { id: row.id },
        data: {
          coverImage: resolveContentUrl(row.coverImage, map),
          detailCoverImage: resolveContentUrl(row.detailCoverImage, map),
          images: resolveImages(row.images, map),
        },
      }),
    ),
  ]);
}
