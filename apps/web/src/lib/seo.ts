import type { Metadata } from 'next';
import { resolveMediaUrl } from '@/lib/media-url';
import { siteConfig } from '@/lib/site';

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noSuffix?: boolean;
  siteName?: string;
}

export const metadataBase = new URL(siteConfig.url);

export function generateSeo({
  title,
  description,
  path = '',
  image,
  type = 'website',
  noSuffix = false,
  siteName,
}: SeoProps): Metadata {
  const brand = siteName ?? siteConfig.name;
  const url = `${siteConfig.url}${path}`;
  const defaultImage = resolveMediaUrl('/og-default.jpg');
  const ogImage = image ? resolveMediaUrl(image) : defaultImage;

  return {
    title: noSuffix ? title : `${title} | ${brand}`,
    description,
    keywords: [...siteConfig.keywords],
    metadataBase,
    openGraph: {
      title,
      description,
      url,
      siteName: brand,
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      locale: 'zh_CN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: url },
  };
}

export const defaultMetadata: Metadata = generateSeo({
  title: `${siteConfig.name} | 应急救援训练装备专业制造商`,
  description: siteConfig.description,
  path: '/',
  noSuffix: true,
});
