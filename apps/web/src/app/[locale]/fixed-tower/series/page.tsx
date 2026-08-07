import { Check, CloudRain, Link2, Recycle, Shield, X } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { ProductGallery } from '@/components/products/ProductLineMedia';
import { FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getProductPageImages } from '@/lib/product-images';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const PAGE = getProductPageImages('fixed-series');
const HERO_POSTER = PAGE.heroImage;
const HERO_VIDEO = '/media/mission.mp4';
const STRUCTURE_IMAGES = PAGE.detailImages ?? [];
const DURABILITY_ICONS = [Shield, Link2, CloudRain, Recycle] as const;
const RELATED_HREFS = ['/fixed-tower/custom', '/burn-rooms', '/resources/design-center'] as const;

type CmpRow = { feature: string; standard: boolean | string; custom: boolean | string };

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.fixedTowerSeries',
    path: '/fixed-tower/series',
    image: PAGE.ogImage ?? PAGE.heroImage,
  });
}

export default async function FixedTowerSeriesPage() {
  const t = await getTranslations('pages.fixedTowerSeries');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const durabilityRaw = t.raw('durability') as Array<{ title: string; desc: string }>;
  const durability = durabilityRaw.map((item, i) => ({
    ...item,
    icon: DURABILITY_ICONS[i] ?? DURABILITY_ICONS[0],
  }));
  const series = t.raw('series') as Array<{
    name: string;
    variants: string;
    desc: string;
    image: string;
  }>;
  const moreSeries = t.raw('moreSeries') as Array<{ name: string; variants: string; desc: string }>;
  const compare = t.raw('compare') as {
    headers: { feature: string; standard: string; custom: string };
    ariaSupported: string;
    ariaNotSupported: string;
    rows: CmpRow[];
  };
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  const galleryItems = gallery.map((g, i) => ({
    src: STRUCTURE_IMAGES[i] ?? STRUCTURE_IMAGES[0] ?? HERO_POSTER,
    alt: g.alt,
  }));

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
        video={HERO_VIDEO}
        poster={HERO_POSTER}
      >
        <BookConsultButton variant="light" message={tCommon('bookConsultProduct')}>
          {tCta('bookConsult')}
        </BookConsultButton>
      </VideoHero>

      <ProductGallery items={galleryItems} fallbackSrc={HERO_POSTER} />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('complianceSection.eyebrow')}
            title={t('complianceSection.title')}
            description={t('complianceSection.description')}
          />
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('durabilitySection.eyebrow')}
            title={t('durabilitySection.title')}
            description={t('durabilitySection.description')}
          />
          <div className="mt-10">
            <FeatureGrid items={durability} columns={4} />
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-secondary-text">
            {t('durabilitySection.note')}
          </p>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <h2 className="rb-h2 mb-10 text-neutral-900">{t('seriesSectionTitle')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {series.map((s) => (
              <div key={s.name} className="flex flex-col border border-neutral-300 bg-white">
                <div className="relative aspect-[16/10] overflow-hidden border-b border-neutral-300 bg-white">
                  <Image
                    src={s.image}
                    alt={s.name}
                    fill
                    quality={80}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain p-4"
                  />
                </div>
                <div className="p-6">
                  <h3 className="rb-h5 text-neutral-900">{s.name}</h3>
                  <span className="mt-1 block text-xs font-bold text-primary">{s.variants}</span>
                  <p className="mt-3 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {moreSeries.map((s) => (
              <div key={s.name} className="flex flex-col border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{s.name}</h3>
                <span className="mt-1 text-xs font-bold text-primary">{s.variants}</span>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 border border-neutral-300 bg-white p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="rb-h4 text-neutral-900">{t('midCta.title')}</h3>
              <p className="mt-2 text-sm text-secondary-text">{t('midCta.description')}</p>
            </div>
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('compareSection.eyebrow')}
            title={t('compareSection.title')}
            description={t('compareSection.description')}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {compare.headers.feature}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {compare.headers.standard}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {compare.headers.custom}
                  </th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map((r) => (
                  <tr key={r.feature} className="border-b border-neutral-300 align-middle">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.feature}</td>
                    {[r.standard, r.custom].map((v, i) => (
                      <td key={`${r.feature}-${i}`} className="p-4 text-sm text-secondary-text">
                        {v === true ? (
                          <Check
                            className="h-5 w-5 text-primary"
                            aria-label={compare.ariaSupported}
                          />
                        ) : v === false ? (
                          <X
                            className="h-5 w-5 text-neutral-300"
                            aria-label={compare.ariaNotSupported}
                          />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <RbLink href="/fixed-tower/custom">{t('cta.customLink')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
