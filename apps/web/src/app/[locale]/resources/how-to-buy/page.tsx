import { getTranslations } from 'next-intl/server';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, SectionHeading, VideoHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesHowToBuy',
    path: '/resources/how-to-buy',
  });
}

const RELATED_HREFS = ['/resources/design-center', '/resources/faqs', '/resources/warranty'];

export default async function HowToBuyPage() {
  const t = await getTranslations('pages.resourcesHowToBuy');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const steps = t.raw('steps') as Array<{ step: string; title: string; desc: string }>;
  const procurement = t.raw('procurement') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
        video="/media/louisville-case.mp4"
        poster="/media/fixed-tower-hero.jpg"
      />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('introSection.eyebrow')}
              title={t('introSection.title')}
              description={t('introSection.description')}
            />
            <div className="flex flex-col justify-center">
              <p className="text-base leading-relaxed text-neutral-900">{t('introSection.lead')}</p>
              <ul className="mt-4 space-y-3 text-base leading-relaxed text-secondary-text">
                <li>
                  <span className="font-bold text-neutral-900">
                    {t('introSection.collaborationLabel')}
                  </span>
                  {' —— '}
                  {t('introSection.collaborationText')}
                </li>
                <li>
                  <span className="font-bold text-neutral-900">
                    {t('introSection.visionLabel')}
                  </span>
                  {' —— '}
                  {t('introSection.visionText')}
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('stepsSection.eyebrow')} title={t('stepsSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="border-t-2 border-primary bg-white p-6">
                <span className="font-display text-2xl font-bold text-primary">{s.step}</span>
                <h3 className="rb-h5 mt-2 text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('procurementSection.eyebrow')}
            title={t('procurementSection.title')}
          />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {procurement.map((p) => (
              <li
                key={p}
                className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900"
              >
                {p}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <CtaBand
        title={t('cta.title')}
        description={t('cta.description')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/resources/design-center"
      />
    </div>
  );
}
