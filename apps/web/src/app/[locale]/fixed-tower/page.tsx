import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { Container, RbLink, SectionHeading, VideoHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.fixedTower', path: '/fixed-tower' });
}

const HERO_IMAGE = '/media/fixed-tower-hero.jpg';
const HERO_VIDEO = '/media/fixed-tower.mp4';

export default async function FixedTowerPage() {
  const t = await getTranslations('pages.fixedTower');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const standardFeatures = t.raw('standardFeatures') as string[];
  const customFeatures = t.raw('customFeatures') as string[];
  const compare = t.raw('compare') as {
    standard: { title: string; points: string[] };
    custom: { title: string; points: string[] };
  };
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const relatedHrefs = ['/fixed-tower/series', '/fixed-tower/custom', '/burn-rooms'];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.current'), path: '/fixed-tower' },
          ]),
          productJsonLd({
            name: t('jsonLd.productName'),
            description: t('jsonLd.productDescription'),
            path: '/fixed-tower',
            image: HERO_IMAGE,
          }),
        ]}
      />
      <div className="pb-20">
        <VideoHero
          eyebrow={t('hero.eyebrow')}
          title={t('hero.title')}
          description={t('hero.description')}
          video={HERO_VIDEO}
          poster={HERO_IMAGE}
        >
          <BookConsultButton variant="light" message={tCommon('bookConsultProduct')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </VideoHero>

        <section id="overview" className="scroll-mt-24">
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <SectionHeading
                eyebrow={t('overview.eyebrow')}
                title={t('overview.title')}
                description={t('overview.description')}
              />
              <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
                <p className="text-lg leading-relaxed text-neutral-900">{t('overview.lead')}</p>
                <p className="text-secondary-text">{t('overview.body')}</p>
              </div>
            </div>
          </Container>
        </section>

        <StatBandI18n />

        <section id="series" className="scroll-mt-24 bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('series.eyebrow')}
              title={t('series.title')}
              description={t('series.description')}
            />
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {standardFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 border border-neutral-300 bg-white p-6"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm leading-relaxed text-neutral-900">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <RbLink href="/fixed-tower/series">{t('series.linkText')}</RbLink>
            </div>
          </Container>
        </section>

        <section id="custom" className="scroll-mt-24">
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col gap-6">
                <SectionHeading
                  eyebrow={t('custom.eyebrow')}
                  title={t('custom.title')}
                  description={t('custom.description')}
                />
                <RbLink href="/fixed-tower/custom">{t('custom.linkText')}</RbLink>
              </div>
              <ul className="flex flex-col justify-center gap-4">
                {customFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-base text-neutral-900">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        <section className="bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <h2 className="rb-h2 mb-10 text-neutral-900">{t('compareSection.title')}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[compare.standard, compare.custom].map((col) => (
                <div key={col.title} className="border border-neutral-300 bg-white p-8">
                  <h3 className="rb-h4 mb-6 text-neutral-900">{col.title}</h3>
                  <ul className="space-y-3">
                    {col.points.map((p) => (
                      <li key={p} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm leading-relaxed text-secondary-text">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <ProcessBandI18n />

        <RelatedLinks
          title={tBlocks('titleDefault')}
          learnMore={tBlocks('learnMore')}
          eyebrow={tBlocks('eyebrow')}
          links={relatedLinks.map((l, i) => ({ ...l, href: relatedHrefs[i]! }))}
        />

        <Container className="pt-16 lg:pt-24">
          <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
            <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
            <p className="text-secondary-text">{t('cta.description')}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <BookConsultButton message={tCommon('bookConsultProduct')}>{tCta('bookConsult')}</BookConsultButton>
              <RbLink href="/modular-tower">{t('cta.secondaryLink')}</RbLink>
              <RbLink href="/docs/fixed-tower-specs.pdf">{tCta('downloadPdf')}</RbLink>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
