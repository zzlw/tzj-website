import { getLocale, getTranslations } from 'next-intl/server';
import { generateSeo } from '@/lib/seo';

type PageMetaInput = {
  /** next-intl 命名空间，如 pages.fixedTower */
  namespace: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
};

/** 从 i18n 命名空间读取 meta.title / meta.description 并生成 SEO Metadata。 */
export async function createPageMetadata({ namespace, path, image, type }: PageMetaInput) {
  const locale = await getLocale();
  const t = await getTranslations(namespace);
  const tCommon = await getTranslations('common');
  return generateSeo({
    title: t('meta.title'),
    description: t('meta.description'),
    locale,
    path,
    image,
    type,
    siteName: tCommon('brandName'),
  });
}
