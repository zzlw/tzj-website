import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

// 动态把 S3/OSS 公开域名加入 images.remotePatterns。
// 优先读取 NEXT_PUBLIC_S3_PUBLIC_DOMAIN（dev/prod 均配置），
// 避免硬编码域名（见 AGENTS.md 对象存储规范）；下列静态兜底覆盖常见本地/线上域名。
type RemotePatternEntry = {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
};

const s3RemotePatterns: RemotePatternEntry[] = (() => {
  const domain = process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;
  if (!domain) return [];
  try {
    const u = new URL(domain);
    return [
      {
        protocol: u.protocol.replace(':', '') as 'http' | 'https',
        hostname: u.hostname,
        port: u.port || undefined,
        pathname: '/**',
      },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  output: 'standalone',
  // 生产构建将 _next/static 托管到 OSS/CDN（NEXT_PUBLIC_ASSET_PREFIX 由 CI 注入）；
  // dev 无该变量时保持空字符串，继续走本地静态资源。
  assetPrefix: (process.env.NEXT_PUBLIC_ASSET_PREFIX ?? '').replace(/\/$/, ''),
  transpilePackages: ['@tzj/device', '@tzj/ui', '@tzj/types'],
  experimental: {
    /** 按需 tree-shake lucide 等 barrel 包，减小客户端 bundle。 */
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [
      {
        source: '/:locale/resources/news/1000-projects-milestone',
        destination: '/:locale/resources/news/turnkey-delivery-network',
        permanent: true,
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 75, 80, 90],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      { protocol: 'https', hostname: '**.tzjii.com', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      // 运行时 S3/OSS 域名（聊天附件等媒体），从环境变量注入
      ...s3RemotePatterns,
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
