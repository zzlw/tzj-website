import { Flame, Handshake, HardHat } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { siteCoverByHref } from '@/lib/site-cover';
import { WHY_US_IMAGES } from '@/lib/why-us-images';

const WHY_ICONS = [Flame, HardHat, Handshake] as const;
const RELATED_HREFS = ['/why-us/story', '/why-us/certification', '/why-us/global'];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.whyUsTeam',
    path: '/why-us/team',
    image: WHY_US_IMAGES.team.og,
  });
}

export default async function TeamPage() {
  const t = await getTranslations('pages.whyUsTeam');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const team = t.raw('team') as Array<{ name: string; tag: string; desc: string }>;
  const whyRaw = t.raw('why') as Array<{ title: string; desc: string }>;
  const why = whyRaw.map((item, i) => ({ ...item, icon: WHY_ICONS[i]! }));
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />
      <div className="rb-img-shimmer relative aspect-[21/9] max-h-[560px] w-full overflow-hidden bg-neutral-200">
        <Image
          src={WHY_US_IMAGES.team.hero}
          alt={t('hero.imageAlt')}
          fill
          quality={80}
          sizes="100vw"
          className="object-cover"
          loading="eager"
        />
      </div>
      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('teamSection.eyebrow')} title={t('teamSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <div key={m.name} className="border border-neutral-300 bg-white p-6">
                <span className="text-xs font-bold uppercase tracking-wide text-primary">
                  {m.tag}
                </span>
                <h3 className="rb-h5 mt-2 text-neutral-900">{m.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{m.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <StatBandI18n />
      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('whySection.eyebrow')}
            title={t('whySection.title')}
            description={t('whySection.description')}
          />
          <div className="rb-img-shimmer relative mt-10 aspect-[21/9] overflow-hidden bg-neutral-200">
            <Image
              src={WHY_US_IMAGES.team.collab}
              alt={t('collabImageAlt')}
              fill
              quality={75}
              sizes="100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-10">
            <FeatureGrid items={why} columns={3} />
          </div>
        </Container>
      </section>
      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => {
          const href = RELATED_HREFS[i]!;
          return { ...l, href, image: siteCoverByHref(href) };
        })}
      />
      <CtaBand
        title={t('cta.title')}
        description={t('cta.description')}
        primaryLabel={tCta('bookConsult')}
      />
    </div>
  );
}
