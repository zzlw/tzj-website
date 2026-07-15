import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const HERO_IMAGE = '/media/tower-wylie.jpg';
const RELATED_HREFS = ['/cases', '/why-us/story', '/why-us/team'];

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.whyUsGlobal', path: '/why-us/global' });
}

export default async function GlobalPage() {
  const t = await getTranslations('pages.whyUsGlobal');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const regions = t.raw('regions') as string[];
  const sectors = t.raw('sectors') as string[];
  const highlights = t.raw('highlights') as Array<{ title: string; desc: string }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <section className="relative flex min-h-[620px] items-center justify-center overflow-hidden bg-neutral-900 pt-16 lg:min-h-[720px]">
        <Image
          src={HERO_IMAGE}
          alt={t('hero.imageAlt')}
          fill
          sizes="100vw"
          className="object-cover object-center"
          preload
          loading="eager"
        />
        <div className="absolute inset-0 rb-media-shade-strong" />
        <Container className="rb-on-media relative z-10 flex flex-col items-center py-16 text-center lg:py-24">
          <Eyebrow inverted>{t('hero.eyebrow')}</Eyebrow>
          <h1 className="rb-h1 mt-5 max-w-4xl text-white">{t('hero.title')}</h1>
          <span className="mt-6 h-1 w-20 bg-primary" />
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            {t('hero.description')}
          </p>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('overviewSection.eyebrow')}
            title={t('overviewSection.title')}
            description={t('overviewSection.description')}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {regions.map((r) => (
              <span
                key={r}
                className="border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {r}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('sectorsSection.eyebrow')}
            title={t('sectorsSection.title')}
            description={t('sectorsSection.description')}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {sectors.map((s) => (
              <span
                key={s}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {s}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('highlightsSection.eyebrow')}
            title={t('highlightsSection.title')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {highlights.map((h) => (
              <div key={h.title} className="border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{h.desc}</p>
              </div>
            ))}
          </div>
          <blockquote className="mt-10 border-l-4 border-primary bg-white p-8">
            <p className="rb-h5 leading-relaxed text-neutral-900">"{t('quote.text')}"</p>
            <footer className="mt-4 text-sm font-bold text-secondary-text">
              {t('quote.attribution')}
            </footer>
          </blockquote>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />
      <CtaBand title={t('cta.title')} primaryLabel={tCta('bookConsult')} />
    </div>
  );
}
