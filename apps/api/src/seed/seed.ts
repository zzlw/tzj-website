#!/usr/bin/env node

// ============================================================
// TZJ — Database Seed Script
// ============================================================
// 用法: npx tsx src/seed/seed.ts
// 前提: 先运行 upload-media.ts 生成 media-map.json
// 功能:
//   1. 解析 www.tzjii.com HTML 提取案例/新闻/方案/页面数据
//   2. 替换图片路径为 MinIO URL
//   3. 写入 PostgreSQL
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client/index';

// ── Config ──────────────────────────────────────────────────
const WORKSPACE = path.resolve(__dirname, '../../../../..');
const TZJII_DIR = path.join(WORKSPACE, 'www.tzjii.com');
const MAP_FILE = path.join(__dirname, 'media-map.json');
const PUBLIC_DOMAIN = 'http://localhost:9000/tzj-uploads-dev';

const prisma = new PrismaClient();

// ── Load media map ──────────────────────────────────────────
let mediaMap: Record<string, string> = {};
if (fs.existsSync(MAP_FILE)) {
  mediaMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
  console.log(`📄 Loaded media map: ${Object.keys(mediaMap).length} entries`);
} else {
  console.warn('⚠️  media-map.json not found, images will use original paths');
}

// ── Resolve image path to MinIO URL ─────────────────────────
function resolveImage(htmlPath: string): string | null {
  if (!htmlPath) return null;
  // Normalize path
  const normalized = htmlPath.replace(/^\//, '').replace(/^uploads\//, 'uploads/');
  // Try direct match
  if (mediaMap[normalized]) return mediaMap[normalized];
  if (mediaMap[htmlPath]) return mediaMap[htmlPath];
  // Try with uploads/images/ prefix
  const withPrefix = `uploads/images/${htmlPath.replace(/^.*uploads\/images\//, '')}`;
  if (mediaMap[withPrefix]) return mediaMap[withPrefix];
  // Fallback: construct MinIO URL directly
  const cleanPath = htmlPath.replace(/^\//, '');
  if (cleanPath.startsWith('uploads/images/')) {
    return `${PUBLIC_DOMAIN}/images/${cleanPath.replace('uploads/images/', '')}`;
  }
  if (cleanPath.startsWith('statics/images/')) {
    return `${PUBLIC_DOMAIN}/statics/${cleanPath.replace('statics/images/', '')}`;
  }
  return null;
}

// ── HTML parsing helpers ────────────────────────────────────

function readHtml(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function extractTitle(html: string): string {
  // Try <h1 class="title"> first (detail pages)
  const h1Match = html.match(/<h1[^>]*class="title"[^>]*>(.*?)<\/h1>/s);
  if (h1Match?.[1]) return h1Match[1].trim();
  // Try goods-spec h1 (product pages)
  const goodsMatch = html.match(/<div class="goods-spec">\s*<h1>(.*?)<\/h1>/s);
  if (goodsMatch?.[1]) return goodsMatch[1].trim();
  // Try <title> tag
  const titleMatch = html.match(/<title>(.*?)<\/title>/s);
  if (titleMatch?.[1]) {
    const raw = titleMatch[1].trim();
    // Remove suffix like "_拓展器材丨..."
    return raw.split('_')[0] ?? raw;
  }
  return 'Untitled';
}

function extractContent(html: string): string {
  // Extract content from <div class="content"> or <div class="tab-content entry">
  const contentMatch = html.match(
    /<div class="(?:tab-content entry|content)"[^>]*>([\s\S]*?)(?:<\/div>\s*<(?:div id="tabHead"|div class="show-page"))/s,
  );
  if (contentMatch?.[1]) {
    return replaceImagesInHtml(contentMatch[1].trim());
  }
  // Fallback: try simpler content div
  const simpleMatch = html.match(/<div class="content">\s*([\s\S]*?)\s*<\/div>/s);
  if (simpleMatch?.[1]) {
    return replaceImagesInHtml(simpleMatch[1].trim());
  }
  return '';
}

function replaceImagesInHtml(html: string): string {
  // Replace all img src attributes
  return html.replace(
    /(?:src|jqimg|bimg)=["']?([^"'>\s]+(?:\.(?:jpg|jpeg|png|webp|gif))[^"'>\s]*)/gi,
    (match, srcPath: string) => {
      const resolved = resolveImage(srcPath);
      if (resolved) {
        return match.replace(srcPath, resolved);
      }
      return match;
    },
  );
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /(?:src|jqimg|bimg)=["']?((?:uploads\/images\/|\/uploads\/images\/)[^"'>\s]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const srcPath: string | undefined = match[1];
    if (!srcPath) continue;
    const resolved = resolveImage(srcPath);
    if (resolved && !images.includes(resolved)) {
      images.push(resolved);
    }
  }
  return images;
}

function extractCoverImage(html: string): string | null {
  // Try banner image first
  const bannerMatch = html.match(/class="n_banner"[\s\S]*?<img src="([^"]+)"/);
  if (bannerMatch?.[1]) {
    return resolveImage(bannerMatch[1]);
  }
  // Try first product image
  const picMatch = html.match(/class="pic-preview"[\s\S]*?src="([^"]+)"/);
  if (picMatch?.[1]) {
    return resolveImage(picMatch[1]);
  }
  // Try first content image
  const firstImg = html.match(/class="content"[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (firstImg?.[1]) {
    return resolveImage(firstImg[1]);
  }
  // Try first news list image
  const newsImg = html.match(/class="img"[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (newsImg?.[1]) {
    return resolveImage(newsImg[1]);
  }
  return null;
}

function extractSummary(html: string): string {
  // Try meta description
  const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
  if (metaMatch?.[1]) return metaMatch[1].trim();
  return '';
}

function extractDate(html: string): Date {
  const dateMatch = html.match(/更新时间:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (dateMatch?.[1]) return new Date(dateMatch[1]);
  return new Date();
}

// ── Generate slug from filename ─────────────────────────────
function slugFromFilename(filename: string): string {
  return filename.replace(/\.html$/, '').replace(/[^a-zA-Z0-9-]/g, '-');
}

const CASE_TYPE_MAP: Record<number, string> = {
  52: 'military',
  53: 'fire',
  54: 'police',
  55: 'scenic',
  56: 'school',
  57: 'enterprise',
};

const NEWS_CAT_MAP: Record<number, string> = {
  64: 'company',
  65: 'industry',
  66: 'knowledge',
  67: 'equipment',
};

function getCaseType(filename: string): string {
  const match = filename.match(/caseshow-(\d+)-\d+\.html/);
  if (!match || !match[1]) return 'fire';
  const typeId = Number.parseInt(match[1], 10);
  return CASE_TYPE_MAP[typeId] ?? 'fire';
}

function getNewsCategory(filename: string): string {
  const match = filename.match(/newsshow-(\d+)-\d+\.html/);
  if (!match || !match[1]) return 'company';
  const catId = Number.parseInt(match[1], 10);
  return NEWS_CAT_MAP[catId] ?? 'company';
}

// ── File discovery ──────────────────────────────────────────
function findHtmlFiles(pattern: RegExp): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(TZJII_DIR)) {
    if (pattern.test(entry)) {
      files.push(entry);
    }
  }
  return files.sort();
}

// ── Seed functions ──────────────────────────────────────────

async function seedCases(): Promise<void> {
  console.log('\n📦 Seeding cases...');
  const files = findHtmlFiles(/^caseshow-\d+-\d+\.html$/);
  console.log(`   Found ${files.length} case files`);

  let count = 0;
  for (const file of files) {
    const html = readHtml(path.join(TZJII_DIR, file));
    const title = extractTitle(html);
    const slug = slugFromFilename(file);
    const summary = extractSummary(html);
    const content = extractContent(html);
    const allImages = extractImages(html);
    const coverImage = allImages[0] ?? null;
    const caseType = getCaseType(file);

    await prisma.case.upsert({
      where: { slug },
      update: {},
      create: {
        title,
        slug,
        summary,
        description: content,
        coverImage,
        images: allImages,
        caseType,
        status: 'published',
        isFeatured: count < 6,
        sortOrder: count,
      },
    });
    count++;
  }
  console.log(`   ✅ ${count} cases`);
}

async function seedNews(): Promise<void> {
  console.log('\n📦 Seeding news...');
  const files = findHtmlFiles(/^newsshow-\d+-\d+\.html$/);
  console.log(`   Found ${files.length} news files`);

  let count = 0;
  for (const file of files) {
    const html = readHtml(path.join(TZJII_DIR, file));
    const title = extractTitle(html);
    const slug = slugFromFilename(file);
    const summary = extractSummary(html);
    const content = extractContent(html);
    const allImages = extractImages(html);
    const coverImage = allImages[0] ?? null;
    const category = getNewsCategory(file);
    const publishedAt = extractDate(html);

    await prisma.news.upsert({
      where: { slug },
      update: {},
      create: {
        title,
        slug,
        summary,
        content,
        coverImage,
        images: allImages,
        category,
        author: '拓之迹',
        status: 'published',
        publishedAt,
        sortOrder: count,
      },
    });
    count++;
  }
  console.log(`   ✅ ${count} news articles`);
}

async function seedPages(): Promise<void> {
  console.log('\n📦 Seeding static pages...');

  const pages = [
    { file: 'page-38.html', slug: 'service', title: '服务承诺' },
    { file: 'page-40.html', slug: 'about', title: '关于我们' },
    { file: 'page-41.html', slug: 'contact', title: '联系我们' },
  ];

  let count = 0;
  for (const page of pages) {
    const filePath = path.join(TZJII_DIR, page.file);
    if (!fs.existsSync(filePath)) continue;

    const html = readHtml(filePath);
    const title = extractTitle(html) || page.title;
    const content = extractContent(html);
    const coverImage = extractCoverImage(html);

    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        title,
        slug: page.slug,
        content,
        coverImage,
        status: 'published',
        sortOrder: count,
      },
    });
    count++;
  }
  console.log(`   ✅ ${count} pages`);
}

// ── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🚀 TZJ Database Seed');
  console.log(`   Workspace: ${WORKSPACE}`);
  console.log(`   TZJII dir: ${TZJII_DIR}`);

  const startTime = Date.now();

  // Run in order
  await seedCases();
  await seedNews();
  await seedPages();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Seed completed in ${elapsed}s`);

  // Print summary
  const [caseCount, newsCount, pageCount] = await Promise.all([
    prisma.case.count(),
    prisma.news.count(),
    prisma.page.count(),
  ]);

  console.log('\n📊 Database summary:');
  console.log(`   Cases:     ${caseCount}`);
  console.log(`   News:      ${newsCount}`);
  console.log(`   Pages:     ${pageCount}`);
}

main()
  .catch((err: unknown) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
