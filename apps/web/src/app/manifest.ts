import type { MetadataRoute } from 'next';
import { getS3PublicDomain } from '@/lib/media-url';
import { siteConfig } from '@/lib/site';

const s3Base = getS3PublicDomain().replace(/\/$/, '');

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.legalName,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e3000f',
    lang: 'zh-CN',
    icons: [
      {
        src: `${s3Base}/statics/favicon.ico`,
        // OSS 上的 ICO 实际为单张 32x32；声明 'any' 会触发 Chrome
        // "Resource size is not correct" 警告，须与真实像素一致
        sizes: '32x32',
        type: 'image/x-icon',
      },
      {
        src: `${s3Base}/statics/apple-touch-icon.png`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
