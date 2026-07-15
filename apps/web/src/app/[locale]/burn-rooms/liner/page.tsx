import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const RELATED_HREFS = ['/burn-rooms/comparison', '/burn-rooms', '/resources/inspections'];

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.burnRoomsLiner', path: '/burn-rooms/liner' });
}

export default async function LinerPage() {
  const t = await getTranslations('pages.burnRoomsLiner');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const specs = t.raw('specs') as Array<{ item: string; value: string }>;
  const features = t.raw('features') as string[];
  const performance = t.raw('performance') as string[];
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
              <Image
                src="/media/burn-room.webp"
                alt={t('gallery.linerAlt')}
                fill
                quality={70}
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
              <Image
                src="/media/galvanized-stair.webp"
                alt={t('gallery.steelAlt')}
                fill
                quality={70}
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('specsSection.eyebrow')}
            title={t('specsSection.title')}
            description={t('specsSection.description')}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <tbody>
                {specs.map((s) => (
                  <tr key={s.item} className="border-b border-neutral-300">
                    <td className="w-40 p-4 text-sm font-bold text-neutral-900">{s.item}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('featuresSection.eyebrow')}
            title={t('featuresSection.title')}
          />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 bg-white p-5">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-base text-neutral-900">{f}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('performanceSection.eyebrow')}
            title={t('performanceSection.title')}
            description={t('performanceSection.description')}
          />
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {performance.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <CtaBand
        title={t('cta.title')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/burn-rooms/comparison"
      />
    </div>
  );
}
