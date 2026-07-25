#!/usr/bin/env node

// ============================================================
// TZJ — 一次性恢复脚本：本地 staging 目录 → MinIO tzj-uploads-dev
// ============================================================
// 用法:
//   node --env-file=../../.env scripts/restore-media-to-minio.mjs <stagingRoot>
// 说明:
//   - key = 文件相对 stagingRoot 的路径（保留 cases/ content/ images/{YYYYMM}/ 等前缀）
//   - 全量覆盖上传（PutObject 直接覆盖同名对象），对齐生产 OSS
//   - 跳过 tzj_dev.dump / *.log 等非媒体文件
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const STAGING_ROOT = path.resolve(process.argv[2] ?? '../../.tmp/oss-restore');
const BUCKET = process.env.S3_BUCKET || 'tzj-uploads-dev';
const ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const REGION = process.env.S3_REGION || 'us-east-1';
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || 'minioadmin';
const SECRET_KEY = process.env.S3_ACCESS_KEY_SECRET || 'minioadmin';
const CONCURRENCY = 12;

// 非媒体产物：不进 MinIO
const SKIP_NAMES = new Set(['tzj_dev.dump', 'download.log']);
const SKIP_EXTS = new Set(['.log', '.dump']);

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function mimeType(p) {
  return MIME_MAP[path.extname(p).toLowerCase()] ?? 'application/octet-stream';
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function main() {
  console.log('🚀 Restore media → MinIO');
  console.log(`   Staging:  ${STAGING_ROOT}`);
  console.log(`   Endpoint: ${ENDPOINT}`);
  console.log(`   Bucket:   ${BUCKET}\n`);

  const files = walk(STAGING_ROOT).filter((f) => {
    const base = path.basename(f);
    if (SKIP_NAMES.has(base)) return false;
    if (SKIP_EXTS.has(path.extname(f).toLowerCase())) return false;
    return true;
  });
  console.log(`   Files to upload: ${files.length}\n`);

  const perPrefix = {};
  let done = 0;
  let failed = 0;

  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      const key = path.relative(STAGING_ROOT, file).split(path.sep).join('/');
      const prefix = key.split('/')[0] || '(root)';
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: fs.readFileSync(file),
            ContentType: mimeType(file),
          }),
        );
        perPrefix[prefix] = (perPrefix[prefix] ?? 0) + 1;
        done++;
        if (done % 100 === 0) console.log(`   ...${done}/${files.length}`);
      } catch (err) {
        failed++;
        console.error(`   ❌ ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('\n📊 Uploaded per prefix:');
  for (const [p, n] of Object.entries(perPrefix).sort()) console.log(`   ${p}/: ${n}`);
  console.log(`\n✅ Done: ${done} uploaded, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
