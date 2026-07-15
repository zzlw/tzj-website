import {
  ArrowUpDown,
  Biohazard,
  Box,
  Droplets,
  Flame,
  Hammer,
  LayoutGrid,
  MountainSnow,
  Search,
  Wind,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, RbButton, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.accessories', path: '/accessories' });
}

const HERO_IMAGE = '/media/tower-eastside.jpg';
const FEATURE_ICONS = [
  Biohazard,
  Flame,
  ArrowUpDown,
  Search,
  Box,
  Hammer,
  Wind,
  MountainSnow,
  LayoutGrid,
  Droplets,
] as const;
const RELATED_HREFS = ['/accessories/maritime', '/accessories/tactical', '/accessories/hazmat'];

export default async function AccessoriesPage() {
  const t = await getTranslations('pages.accessories');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const featuresRaw = t.raw('features') as Array<{ title: string; desc: string }>;
  const features = featuresRaw.map((item, i) => ({ ...item, icon: FEATURE_ICONS[i]! }));
  const maritimeFeatures = t.raw('maritime.features') as string[];
  const tacticalScenarios = t.raw('tactical.scenarios') as string[];
  const hazmatProducts = t.raw('hazmat.products') as Array<{ name: string; desc: string }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <section className="relative flex min-h-[460px] items-end overflow-hidden bg-neutral-900 pt-16">
        <Image
          src={HERO_IMAGE}
          alt={t('hero.imageAlt')}
          fill
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
          preload
          loading="eager"
        />
        <div className="absolute inset-0 rb-media-shade-strong" />
        <Container className="rb-on-media relative z-10 py-14 lg:py-20">
          <Eyebrow inverted>{t('hero.eyebrow')}</Eyebrow>
          <h1 className="rb-h1 mt-5 max-w-3xl text-white">{t('hero.title')}</h1>
          <p className="mt-5 max-w-xl text-base text-white/85 md:text-lg">
            {t('hero.description')}
          </p>
          <div className="mt-8">
            <RbButton href="/contact" variant="light">
              {tCta('bookConsult')}
            </RbButton>
          </div>
        </Container>
      </section>

      <section className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('overview.eyebrow')}
            title={t('overview.title')}
            description={t('overview.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {features.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="group border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="rb-h5 mb-2 text-neutral-900">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section id="maritime" className="scroll-mt-24 bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('maritime.eyebrow')}
              title={t('maritime.title')}
              description={t('maritime.description')}
            />
            <div>
              <p className="mb-5 text-base leading-relaxed text-neutral-900">
                {t('maritime.lead')}
              </p>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {maritimeFeatures.map((f) => (
                  <li
                    key={f}
                    className="border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <RbLink href="/accessories/maritime">{t('maritime.linkText')}</RbLink>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="tactical" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('tactical.eyebrow')}
            title={t('tactical.title')}
            description={t('tactical.description')}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {tacticalScenarios.map((s) => (
              <span
                key={s}
                className="border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-8">
            <RbLink href="/accessories/tactical">{t('tactical.linkText')}</RbLink>
          </div>
        </Container>
      </section>

      <section id="hazmat" className="scroll-mt-24 bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('hazmat.eyebrow')}
            title={t('hazmat.title')}
            description={t('hazmat.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hazmatProducts.map((h) => (
              <div key={h.name} className="border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 mb-2 text-neutral-900">{h.name}</h3>
                <p className="text-sm leading-relaxed text-secondary-text">{h.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <RbLink href="/accessories/hazmat">{t('hazmat.linkText')}</RbLink>
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
          <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
        </div>
      </Container>
    </div>
  );
}
