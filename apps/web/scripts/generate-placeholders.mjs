#!/usr/bin/env node
/**
 * 同步 C 端静态媒体资源到 public/media/
 *
 * 图片：优先从本地 trainingtowers.com 复制真实素材，找不到时生成纯色占位图；
 * hero 视频：唯一事实源为对象存储（本地 MinIO / 生产 OSS）content/hero.mp4（已 +faststart），
 * 首次运行下载到 .assets-cache/ 后复用缓存。
 */
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const mediaDir = join(publicDir, 'media');

/** 项目根：tzj-website-reconstruction */
const repoRoot = resolve(__dirname, '../../..');
/** 工作区根：tzj（含 trainingtowers.com、Hero V2.mp4 等） */
const workspaceRoot = process.env.TZJ_ASSETS_ROOT || resolve(repoRoot, '..');
const hubfs = join(workspaceRoot, 'trainingtowers.com/hubfs');
const hsfs = join(workspaceRoot, 'trainingtowers.com/hs-fs/hubfs');

const src = (...parts) => join(hubfs, ...parts);

/** 目标文件名 → 本地源文件（相对 workspaceRoot 或绝对路径） */
const IMAGE_SOURCES = {
  'fixed-tower-hero.jpg': join(
    hsfs,
    'fixed-subpage-hero.jpg?width=3000&name=fixed-subpage-hero.jpg',
  ),
  'modular-hero.jpg': src('CAN_Yellowhead County MODx.jpg'),
  'modular-construction.jpg': src('MODx-construction-1.jpg'),
  'burn-room.webp': src('Burn Room_Option 2_MODx Columbia MO.webp'),
  'tactical.jpg': src('hands-on-tactical-training-min-e1725554677305-768x496.jpg'),
  'tower-wylie.jpg': src('TX_Wylie.jpg'),
  'tower-hamilton.jpg': src('OH_Hamilton Township.jpg'),
  'tower-eastside.jpg': src('WA_Eastside Fire & Rescue.jpg'),
  'tower-macon.jpg': src('GA_Macon Bibb.jpg'),
  'tower-denver.jpg': src('CO_Denver-min.jpg'),
  'tower-chino.jpg': src('CA_Chino-min.jpg'),
  'maritime-astoria.jpg': src('Maritime Astoria, OR Exterior 11.jpg'),
  'maritime-miami.jpg': src('Maritime Miami-Dade, FL Exterior 1.jpg'),
  'maritime-jacksonville.jpg': src('Maritime Jacksonville, FL Exterior 5.jpg'),
  'hazmat-trailer.webp': src('Hazmat-Trailer_web_2.webp'),
  'galvanized-stair.webp': src(
    'WHP-Trainingtowers-MODx-Cambridge-MA-tower-interior-stairs-Triumph-Modular.webp.webp',
  ),
  'modular-m.jpg': src('M-Series-MODx_Page_4-1536x991.jpg'),
  'modular-o.png': src('O-Series-MODx-2024-Elevation_web.png'),
  'modular-d.png': src('D-Series-MODx-2024-Elevation_web.png'),
  'modular-x.png': src('X-Series-MODx-2024-Elevation_web.png'),
  'og-default.jpg': src('TX_Wylie.jpg'),
};

const missionVideo = src('25164-348110782_medium.mp4');

/** hero 视频：对象存储是唯一事实源（content/hero.mp4），下载后缓存到 .assets-cache/ */
const assetCacheDir = join(__dirname, '..', '.assets-cache');
const heroVideoCached = join(assetCacheDir, 'hero.mp4');
const s3PublicDomain = process.env.S3_PUBLIC_DOMAIN || 'http://localhost:9000/tzj-uploads-dev';

async function ensureHeroVideo() {
  if ((await fileSize(heroVideoCached)) > 512) return;
  await mkdir(assetCacheDir, { recursive: true });
  const url = `${s3PublicDomain.replace(/\/$/, '')}/content/hero.mp4`;
  console.log(`  ↓ downloading hero video from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hero.mp4 download failed: ${res.status} ${url}`);
  await writeFile(heroVideoCached, Buffer.from(await res.arrayBuffer()));
}

const VIDEO_SOURCES = {
  'hero.mp4': heroVideoCached,
  'mission.mp4': missionVideo,
};

/** 生成可见的纯色 PNG 占位图（1600×900） */
function createSolidPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0; // filter none
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const compressed = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return ~c;
}

async function fileSize(path) {
  try {
    const s = await stat(path);
    return s.size;
  } catch {
    return 0;
  }
}

async function copyIfExists(sourcePath, destPath) {
  const size = await fileSize(sourcePath);
  if (size < 512) return false;
  await copyFile(sourcePath, destPath);
  return true;
}

async function writeFallbackImage(destPath, label) {
  const ext = destPath.split('.').pop()?.toLowerCase();
  // 工业灰 + 品牌红点缀
  const png = createSolidPng(1600, 900, 46, 46, 46);
  if (ext === 'png' || ext === 'webp') {
    await writeFile(destPath, png);
  } else {
    // .jpg 也写入 PNG 数据 — 浏览器/Next 通常仍能解码；更稳妥则统一用 .png 源
    await writeFile(destPath, png);
  }
  console.warn(`  ⚠ fallback placeholder: ${label} → ${destPath}`);
}

async function syncImages() {
  for (const [name, source] of Object.entries(IMAGE_SOURCES)) {
    const dest = join(mediaDir, name);
    const ok = await copyIfExists(source, dest);
    if (ok) {
      console.log(`  ✓ ${name}`);
    } else {
      await writeFallbackImage(dest, name);
    }
  }
}

async function syncVideos() {
  await ensureHeroVideo();
  for (const [name, source] of Object.entries(VIDEO_SOURCES)) {
    const dest = join(mediaDir, name);
    const ok = await copyIfExists(source, dest);
    if (ok) {
      console.log(`  ✓ ${name}`);
    } else {
      console.warn(`  ⚠ missing video source for ${name}`);
    }
  }
}

async function syncMisc() {
  const docsDir = join(publicDir, 'docs');
  await mkdir(docsDir, { recursive: true });

  const ogSrc = IMAGE_SOURCES['og-default.jpg'];
  if ((await fileSize(ogSrc)) > 512) {
    await copyFile(ogSrc, join(publicDir, 'og-default.jpg')).catch(() => {});
  }

  // favicon / apple-touch-icon 已由后台站点设置托管到 OSS statics/，
  // 不再生成本地兜底（见 docs/minio-to-aliyun-oss-migration-plan.md §11.6）
}

async function clearImageCache() {
  const cacheDir = join(__dirname, '..', '.next', 'cache', 'images');
  try {
    const { rm } = await import('node:fs/promises');
    await rm(cacheDir, { recursive: true, force: true });
    console.log('Cleared .next/cache/images');
  } catch {
    // cache may not exist yet
  }
}

async function main() {
  await mkdir(mediaDir, { recursive: true });
  console.log(`Syncing media → ${mediaDir}`);
  console.log(`Asset root: ${workspaceRoot}`);
  console.log('Images:');
  await syncImages();
  console.log('Videos:');
  await syncVideos();
  await syncMisc();
  await clearImageCache();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
