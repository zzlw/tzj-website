import { Boxes, FileBox, FileText, Ruler } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { relatedLinksWithImages } from '@/lib/product-line-page';
import { RESOURCES_IMAGES } from '@/lib/resources-images';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesDesignCenter',
    path: '/resources/design-center',
    image: RESOURCES_IMAGES['design-center'].og,
  });
}

const DOWNLOAD_ICONS = [FileText, Ruler, Boxes, FileBox] as const;
const RELATED_HREFS = ['/resources/how-to-buy', '/fixed-tower/series', '/resources/faqs'];
/** 目录卡封面：产品线高清卡图（1536×1024，与产品页卡片同源） */
const CATALOG_COVERS = [
  '/media/product/towers/fixed-card.webp',
  '/media/product/towers/modular-card.webp',
  '/media/product/burn/liner-card.webp',
  '/media/product/accessories/accessories-card.webp',
] as const;

export default async function DesignCenterPage() {
  const t = await getTranslations('pages.resourcesDesignCenter');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const catalog = t.raw('catalog') as Array<{ title: string; desc: string; href: string }>;
  const resources = t.raw('resources') as string[];
  const downloadsRaw = t.raw('downloads') as Array<{ title: string; desc: string }>;
  const downloads = downloadsRaw.map((item, i) => ({ ...item, icon: DOWNLOAD_ICONS[i]! }));
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <section className="relative h-[380px] overflow-hidden bg-neutral-800 lg:h-[460px]">
        <Image
          src={RESOURCES_IMAGES['design-center'].hero}
          alt={t('hero.title')}
          fill
          preload
          loading="eager"
          fetchPriority="high"
          quality={90}
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 rb-media-shade-strong" />
        <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
          <Eyebrow inverted>{t('hero.eyebrow')}</Eyebrow>
          <h1 className="rb-h1 mt-4 max-w-3xl text-white">{t('hero.title')}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            {t('hero.description')}
          </p>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('catalogSection.eyebrow')} title={t('catalogSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {catalog.map((c, i) => (
              <div
                key={c.title}
                className="group flex flex-col overflow-hidden border border-neutral-300 bg-white"
              >
                {CATALOG_COVERS[i] ? (
                  <div className="rb-img-shimmer relative aspect-[16/9] overflow-hidden bg-neutral-200">
                    <Image
                      src={CATALOG_COVERS[i]!}
                      alt={c.title}
                      fill
                      quality={75}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="rb-h5 text-neutral-900">{c.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                    {c.desc}
                  </p>
                  <div className="mt-4">
                    <RbLink href={c.href}>{t('catalogSection.viewDetails')}</RbLink>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('resourcesSection.eyebrow')}
            title={t('resourcesSection.title')}
          />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {resources.map((r) => (
              <li
                key={r}
                className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900"
              >
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-secondary-text">{t('resourcesSection.note')}</p>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('downloadsSection.eyebrow')}
            title={t('downloadsSection.title')}
            description={t('downloadsSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {downloads.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.title} className="border border-neutral-300 bg-white p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="rb-h5 text-neutral-900">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{d.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          {/* CTA 仅保留单一「预约咨询」按钮（拨号/询盘入口已全局移除） */}
          <BookConsultButton message={tCommon('bookConsultContent')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </div>
      </Container>
    </div>
  );
}
