import { Award, HeartHandshake, Lightbulb, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { siteCoverByHref } from '@/lib/site-cover';
import { WHY_US_IMAGES } from '@/lib/why-us-images';

const VALUE_ICONS = [Award, Lightbulb, ShieldCheck, HeartHandshake] as const;
const RELATED_HREFS = ['/why-us/team', '/why-us/certification', '/why-us/global'];

/** 时间线里程碑配图（按 timeline 数组下标）；无图条目保持纯文字 */
const TIMELINE_IMAGES: Record<number, { src: string; altKey: string }> = {
  3: { src: WHY_US_IMAGES.story.milestoneFactory, altKey: 'timelineImageAltFactory' },
  7: { src: WHY_US_IMAGES.story.milestoneDelivery, altKey: 'timelineImageAltDelivery' },
};

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.whyUsStory',
    path: '/why-us/story',
    image: WHY_US_IMAGES.story.og,
  });
}

export default async function StoryPage() {
  const t = await getTranslations('pages.whyUsStory');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const valuesRaw = t.raw('values') as Array<{ title: string; desc: string }>;
  const values = valuesRaw.map((item, i) => ({ ...item, icon: VALUE_ICONS[i]! }));
  const timeline = t.raw('timeline') as Array<{ year: string; title: string; desc: string }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
        video="/media/mission.mp4"
        poster={WHY_US_IMAGES.story.hero}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('storySection.eyebrow')}
            title={t('storySection.title')}
            description={t('storySection.description')}
          />
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('valuesSection.eyebrow')}
            title={t('valuesSection.title')}
            description={t('valuesSection.description')}
          />
          <div className="mt-10">
            <FeatureGrid items={values} columns={4} />
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <h2 className="rb-h2 mb-10 text-neutral-900">{t('timelineSection.title')}</h2>
          <div className="relative border-l-2 border-neutral-300 pl-8">
            {timeline.map((item, i) => {
              const img = TIMELINE_IMAGES[i];
              return (
                <div key={item.title} className="relative mb-10 last:mb-0">
                  <span className="absolute -left-[2.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-white">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    {item.year}
                  </span>
                  <h3 className="rb-h5 mt-1 text-neutral-900">{item.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-secondary-text">
                    {item.desc}
                  </p>
                  {img ? (
                    <div className="rb-img-shimmer relative mt-4 aspect-[16/9] max-w-2xl overflow-hidden bg-neutral-200">
                      <Image
                        src={img.src}
                        alt={t(img.altKey)}
                        fill
                        quality={70}
                        sizes="(max-width: 1024px) 100vw, 42vw"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
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
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/why-us/team"
      />
    </div>
  );
}
