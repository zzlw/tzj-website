import { Check, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, RbLink, SectionHeading, VideoHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const HERO_IMAGE = '/media/modular-hero.jpg';
const HERO_VIDEO = '/media/modular-tower.mp4';
const RELATED_HREFS = ['/modular-tower/series', '/modular-tower/vs-containers', '/fixed-tower'];

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.modularTower', path: '/modular-tower' });
}

export default async function ModularTowerPage() {
  const t = await getTranslations('pages.modularTower');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const series = t.raw('series') as Array<{ name: string; desc: string; spec: string }>;
  const compareRows = t.raw('compareRows') as Array<{
    label: string;
    modx: string;
    container: string;
  }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
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
            eyebrow={t('seriesSection.eyebrow')}
            title={t('seriesSection.title')}
            description={t('seriesSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {series.map((s) => (
              <div
                key={s.name}
                className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
              >
                <h3 className="rb-h4 text-neutral-900">{s.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                <p className="mt-4 border-t border-neutral-300 pt-3 text-xs font-bold text-primary">
                  {s.spec}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <RbLink href="/modular-tower/series">{t('seriesSection.linkText')}</RbLink>
          </div>
        </Container>
      </section>

      <section id="vs-containers" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('compareSection.eyebrow')}
            title={t('compareSection.title')}
            description={t('compareSection.description')}
          />
          <div className="mt-10 overflow-hidden border border-neutral-300">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-neutral-900 text-white">
                  <th className="p-4 text-sm font-bold">{t('compareSection.headers.feature')}</th>
                  <th className="p-4 text-sm font-bold text-primary">
                    {t('compareSection.headers.modular')}
                  </th>
                  <th className="p-4 text-sm font-bold">{t('compareSection.headers.container')}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? 'bg-neutral-100' : 'bg-white'}>
                    <td className="p-4 align-top text-sm font-bold text-neutral-900">
                      {row.label}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm leading-relaxed text-neutral-900">{row.modx}</span>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-start gap-2">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                        <span className="text-sm leading-relaxed text-secondary-text">
                          {row.container}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8">
            <RbLink href="/modular-tower/vs-containers">{t('compareSection.linkText')}</RbLink>
          </div>
        </Container>
      </section>

      <section id="custom" className="scroll-mt-24 bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow={t('customSection.eyebrow')}
                title={t('customSection.title')}
                description={t('customSection.description')}
              />
              <RbLink href="/modular-tower/custom">{t('customSection.linkText')}</RbLink>
            </div>
            <div className="flex flex-col justify-center gap-5">
              <p className="text-lg leading-relaxed text-neutral-900">{t('customSection.lead')}</p>
              <p className="text-secondary-text">{t('customSection.body')}</p>
            </div>
          </div>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <RbLink href="/burn-rooms">{t('cta.secondaryLink')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
