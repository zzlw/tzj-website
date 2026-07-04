import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(appDir, "..", "..");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@tzj/ui", "@tzj/types"],
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
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
