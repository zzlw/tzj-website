import { Anchor, ArrowUpDown, DoorOpen, Flame, LayoutGrid, Radio, Ship, Waves } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.accessoriesMaritime',
    path: '/accessories/maritime',
  });
}

const GALLERY_SRCS = [
  '/media/maritime-astoria.jpg',
  '/media/maritime-miami.jpg',
  '/media/maritime-jacksonville.jpg',
];
const PROP_ICONS = [Anchor, ArrowUpDown, DoorOpen, Flame, LayoutGrid, Ship] as const;
const RELATED_HREFS = ['/fixed-tower', '/modular-tower', '/accessories'];

export default async function MaritimePage() {
  const t = await getTranslations('pages.accessoriesMaritime');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const propsRaw = t.raw('props') as Array<{ title: string; desc: string }>;
  const props = propsRaw.map((item, i) => ({ ...item, icon: PROP_ICONS[i]! }));
  const extraFeatures = t.raw('extraFeatures') as string[];
  const config = t.raw('config') as Array<{ label: string; value: string }>;
  const users = t.raw('users') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="pt-16 lg:pt-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {gallery.map((g, i) => (
              <div
                key={GALLERY_SRCS[i]}
                className="relative aspect-[4/3] overflow-hidden bg-neutral-900"
              >
                <Image
                  src={GALLERY_SRCS[i]!}
                  alt={g.alt}
                  fill
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('why.eyebrow')}
              title={t('why.title')}
              description={t('why.description')}
            />
            <div className="flex flex-col justify-center">
              <p className="text-base leading-relaxed text-neutral-900">{t('why.lead')}</p>
              <p className="mt-4 text-base leading-relaxed text-secondary-text">{t('why.body')}</p>
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('propsSection.eyebrow')} title={t('propsSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="border border-neutral-300 bg-white p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="rb-h5 text-neutral-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow={t('extraSection.eyebrow')} title={t('extraSection.title')} />
              <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {extraFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
                  >
                    <Waves className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeading
                eyebrow={t('configSection.eyebrow')}
                title={t('configSection.title')}
              />
              <dl className="mt-8 divide-y divide-neutral-200 border border-neutral-300 bg-white">
                {config.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <dt className="text-sm text-secondary-text">{c.label}</dt>
                    <dd className="text-right font-display text-sm font-bold text-neutral-900">
                      {c.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-secondary-text">
                <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {t('configSection.note')}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('usersSection.eyebrow')}
            title={t('usersSection.title')}
            description={t('usersSection.description')}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {users.map((u) => (
              <span
                key={u}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {u}
              </span>
            ))}
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

      <CtaBand
        title={t('cta.title')}
        description={t('cta.description')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/specialized-training"
      />
    </div>
  );
}
