import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const appDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(appDir, '..', '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  // 生产构建将 _next/static 托管到 OSS/CDN（NEXT_PUBLIC_ASSET_PREFIX 由 CI 注入）；
  // dev 无该变量时保持空字符串，继续走本地静态资源。
  assetPrefix: (process.env.NEXT_PUBLIC_ASSET_PREFIX ?? '').replace(/\/$/, ''),
  transpilePackages: ['@tzj/ui', '@tzj/types', '@tzj/dnd'],
  // monorepo 下显式指定 Turbopack 根目录，避免推断错误导致 dev 崩溃
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  images: {
    // Admin 后台图片不需要 Next.js 优化，直接原图即可
    // 省去配置域名白名单的麻烦
    unoptimized: true,
  },
  experimental: {
    // 优化大包导入，减少初始 JS 体积
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
