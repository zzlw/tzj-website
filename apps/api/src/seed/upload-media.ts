#!/usr/bin/env node

// ============================================================
// TZJ — MinIO 媒体批量上传脚本
// ============================================================
// 用法: npx tsx src/seed/upload-media.ts
// 功能:
//   1. 上传 www.tzjii.com/uploads/images/* → MinIO images/
//   2. 上传 www.tzjii.com/statics/images/* → MinIO statics/
//   3. 上传 trainingtowers.com/hubfs/* (选择性) → MinIO products/
//   4. 输出 media-map.json 映射文件供 seed 脚本使用
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// ── Config ──────────────────────────────────────────────────
const BUCKET = 'tzj-uploads-dev';
const ENDPOINT = 'http://localhost:9000';
const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';
const PUBLIC_DOMAIN = `http://localhost:9000/${BUCKET}`;

const WORKSPACE = path.resolve(__dirname, '../../../../..');
const TZJII_DIR = path.join(WORKSPACE, 'www.tzjii.com');
const TT_DIR = path.join(WORKSPACE, 'trainingtowers.com');
const MAP_FILE = path.join(__dirname, 'media-map.json');

// ── MIME type detection ─────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

// ── S3 Client ───────────────────────────────────────────────
const client = new S3Client({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

// ── Upload helper with skip-if-exists ───────────────────────
async function uploadFile(localPath: string, key: string): Promise<string | null> {
  // Check if already exists
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    // Already exists, skip
    return `${PUBLIC_DOMAIN}/${key}`;
  } catch {
    // Not found, proceed with upload
  }

  const buffer = fs.readFileSync(localPath);
  const contentType = getMimeType(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${PUBLIC_DOMAIN}/${key}`;
}

// ── Recursive directory walker ───────────────────────────────
function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Image extension filter ──────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
const MEDIA_EXTS = new Set([...IMAGE_EXTS, '.mp4', '.mp3', '.webm', '.pdf']);

function isMediaFile(filePath: string): boolean {
  return MEDIA_EXTS.has(path.extname(filePath).toLowerCase());
}

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTS.has(path.extname(filePath).toLowerCase());
}

// ── Main upload tasks ───────────────────────────────────────

/**
 * Upload www.tzjii.com/uploads/images/* → MinIO images/{dateDir}/{file}
 */
async function uploadTzjiiImages(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const baseDir = path.join(TZJII_DIR, 'uploads/images');
  console.log('\n📁 Uploading www.tzjii.com/uploads/images/ ...');

  const files = walkDir(baseDir).filter(isImageFile);
  console.log(`   Found ${files.length} image files`);

  let uploaded = 0;
  const skipped = 0;

  for (const file of files) {
    const relPath = path.relative(baseDir, file);
    // Keep the date directory structure: images/202603/xxx.jpg
    const key = `images/${relPath}`;

    try {
      const url = await uploadFile(file, key);
      if (url) {
        // Store mapping: original HTML path → MinIO URL
        const htmlPath = `uploads/images/${relPath}`;
        map[htmlPath] = url;
        uploaded++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ ${relPath}: ${msg}`);
    }

    if ((uploaded + skipped) % 20 === 0 && uploaded + skipped > 0) {
      console.log(`   Progress: ${uploaded + skipped}/${files.length}`);
    }
  }

  console.log(`   ✅ Uploaded: ${uploaded}, Skipped (exists): ${skipped}`);
  return map;
}

/**
 * Upload www.tzjii.com/statics/images/* → MinIO statics/{file}
 */
async function uploadTzjiiStatics(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const baseDir = path.join(TZJII_DIR, 'statics/images');
  console.log('\n📁 Uploading www.tzjii.com/statics/images/ ...');

  const files = walkDir(baseDir).filter(isImageFile);
  console.log(`   Found ${files.length} static image files`);

  let uploaded = 0;

  for (const file of files) {
    const fileName = path.basename(file);
    const key = `statics/${fileName}`;

    try {
      const url = await uploadFile(file, key);
      if (url) {
        const htmlPath = `statics/images/${fileName}`;
        map[htmlPath] = url;
        uploaded++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ ${fileName}: ${msg}`);
    }
  }

  console.log(`   ✅ Uploaded: ${uploaded}`);
  return map;
}

/**
 * Upload trainingtowers.com/hubfs/* (images + video) → MinIO products/{file}
 */
async function uploadTrainingTowers(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const baseDir = path.join(TT_DIR, 'hubfs');
  console.log('\n📁 Uploading trainingtowers.com/hubfs/ ...');

  const files = walkDir(baseDir).filter(isMediaFile);
  console.log(`   Found ${files.length} media files`);

  let uploaded = 0;

  for (const file of files) {
    const fileName = path.basename(file);
    // Skip PDFs for now (too large and not needed for web display)
    if (path.extname(file).toLowerCase() === '.pdf') continue;

    const key = `products/${fileName}`;

    try {
      const url = await uploadFile(file, key);
      if (url) {
        map[fileName] = url;
        uploaded++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ ${fileName}: ${msg}`);
    }
  }

  console.log(`   ✅ Uploaded: ${uploaded}`);
  return map;
}

/**
 * Upload trainingtowers.com/hs-fs/hubfs/* — only largest resolution versions
 * File names like "image.jpg?width=3000&name=image.jpg"
 * We only take files with width=3000 or no width param
 */
async function uploadTrainingTowersHsFs(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const baseDir = path.join(TT_DIR, 'hs-fs/hubfs');
  console.log('\n📁 Uploading trainingtowers.com/hs-fs/hubfs/ (largest only) ...');

  const allFiles = walkDir(baseDir).filter(isImageFile);
  console.log(`   Found ${allFiles.length} total files (filtering for largest)...`);

  // Group files by base image name
  const groups = new Map<string, { file: string; width: number }[]>();

  for (const file of allFiles) {
    const fileName = path.basename(file);
    // Extract base name and width from filename like "image.jpg?width=3000&name=image.jpg"
    const match = fileName.match(/^(.+?\.(?:jpg|jpeg|png|webp|gif|svg))(?:\?width=(\d+))?/i);
    if (!match || !match[1]) continue;

    const baseName: string = match[1];
    const widthStr: string | undefined = match[2];
    const width = widthStr ? Number.parseInt(widthStr, 10) : 99999;

    const existing = groups.get(baseName) ?? [];
    existing.push({ file, width });
    groups.set(baseName, existing);
  }

  let uploaded = 0;

  // Upload only the largest version of each image
  for (const [baseName, versions] of groups) {
    // Sort by width descending, pick the largest
    versions.sort((a, b) => b.width - a.width);
    const largest = versions[0];
    if (!largest) continue;

    const key = `products/${baseName}`;

    try {
      const url = await uploadFile(largest.file, key);
      if (url) {
        map[baseName] = url;
        uploaded++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ ${baseName}: ${msg}`);
    }
  }

  console.log(
    `   ✅ Uploaded: ${uploaded} (from ${groups.size} unique images, ${allFiles.length} total files)`,
  );
  return map;
}

// ── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🚀 TZJ Media Upload to MinIO');
  console.log(`   Endpoint: ${ENDPOINT}`);
  console.log(`   Bucket:   ${BUCKET}`);
  console.log(`   Workspace: ${WORKSPACE}`);

  const startTime = Date.now();

  // Run all uploads
  const [tzjiiImages, tzjiiStatics, ttProducts, ttHsFs] = await Promise.all([
    uploadTzjiiImages(),
    uploadTzjiiStatics(),
    uploadTrainingTowers(),
    uploadTrainingTowersHsFs(),
  ]);

  // Merge all maps
  const fullMap: Record<string, string> = {
    ...tzjiiImages,
    ...tzjiiStatics,
    ...ttProducts,
    ...ttHsFs,
  };

  // Save mapping file
  fs.writeFileSync(MAP_FILE, JSON.stringify(fullMap, null, 2));
  console.log(`\n📄 Media map saved to: ${MAP_FILE}`);
  console.log(`   Total entries: ${Object.keys(fullMap).length}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Completed in ${elapsed}s`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
