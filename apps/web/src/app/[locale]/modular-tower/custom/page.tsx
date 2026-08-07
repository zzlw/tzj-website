import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductGallery, ProductHeroBand } from '@/components/products/ProductLineMedia';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getProductPageImages } from '@/lib/product-images';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const PAGE = getProductPageImages('modular-custom');
const STRUCTURE_IMAGES = PAGE.detailImages ?? [];

const RELATED_HREFS = [
  '/modular-tower/series',
  '/modular-tower/vs-containers',
  '/resources/design-center',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.modularTowerCustom',
    path: '/modular-tower/custom',
    image: PAGE.ogImage ?? PAGE.heroImage,
  });
}

export default async function ModularCustomPage() {
  const t = await getTranslations('pages.modularTowerCustom');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const options = t.raw('options') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  const galleryItems = gallery.map((g, i) => ({
    src: STRUCTURE_IMAGES[i] ?? STRUCTURE_IMAGES[0] ?? PAGE.heroImage,
    alt: g.alt,
  }));

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <ProductHeroBand src={PAGE.heroImage} alt={t('heroImageAlt')} />
      <ProductGallery items={galleryItems} fallbackSrc={PAGE.heroImage} />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('optionsSection.eyebrow')}
              title={t('optionsSection.title')}
              description={t('optionsSection.description')}
            />
            <ul className="flex flex-col justify-center gap-4">
              {options.map((o) => (
                <li key={o} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-base text-neutral-900">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('exampleSection.eyebrow')} title={t('exampleSection.title')} />
          <div className="mt-8 border-l-4 border-primary bg-white p-8">
            <p className="text-base leading-relaxed text-neutral-900">{t('exampleSection.body')}</p>
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

      <CtaBand
        title={t('cta.title')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/modular-tower/series"
      />
    </div>
  );
}
