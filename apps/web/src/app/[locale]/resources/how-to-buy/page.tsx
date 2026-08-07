import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { Link as I18nLink } from '@/i18n/navigation';
import { getCases } from '@/lib/api';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { relatedLinksWithImages } from '@/lib/product-line-page';
import { RESOURCES_IMAGES } from '@/lib/resources-images';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesHowToBuy',
    path: '/resources/how-to-buy',
    image: RESOURCES_IMAGES['how-to-buy'].og,
  });
}

const RELATED_HREFS = ['/resources/design-center', '/resources/faqs', '/resources/warranty'];

interface FeaturedCase {
  slug: string;
  title: string;
  location: string;
  summary: string;
  image: string;
}

/** 拉取已发布的消防类案例（内嵌真实案例卡）；接口异常时降级为空。 */
async function fetchFeaturedCases(limit = 3): Promise<FeaturedCase[]> {
  try {
    const res = await getCases({
      type: 'fire',
      limit,
      sortBy: 'completionDate',
      sortOrder: 'desc',
    });
    return (res.data ?? [])
      .filter((c) => c.coverImage)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        location: c.location ?? '',
        summary: ((c as unknown as { summary?: string }).summary ?? c.description) || '',
        image: c.coverImage,
      }));
  } catch {
    return [];
  }
}

export default async function HowToBuyPage() {
  const t = await getTranslations('pages.resourcesHowToBuy');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const steps = t.raw('steps') as Array<{ step: string; title: string; desc: string }>;
  const procurement = t.raw('procurement') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const sceneImageAlts = t.raw('sceneImageAlts') as string[];
  const featuredCases = await fetchFeaturedCases();

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
        video="/media/mission.mp4"
        poster={RESOURCES_IMAGES['how-to-buy'].hero}
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
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RESOURCES_IMAGES['how-to-buy'].detailImages.map((src, i) => (
              <div
                key={src}
                className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200"
              >
                <Image
                  src={src}
                  alt={sceneImageAlts[i] ?? t('hero.title')}
                  fill
                  quality={75}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
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

      {featuredCases.length > 0 ? (
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('cases.eyebrow')}
              title={t('cases.title')}
              description={t('cases.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {featuredCases.map((item) => (
                <I18nLink
                  key={item.slug}
                  href={`/cases/${item.slug}`}
                  className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                >
                  <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-5">
                    {item.location ? (
                      <p className="text-xs font-bold tracking-wide text-primary">
                        {item.location}
                      </p>
                    ) : null}
                    <h3 className="rb-h5 mt-2 text-neutral-900">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                      {item.summary}
                    </p>
                  </div>
                </I18nLink>
              ))}
            </div>
            <div className="mt-8">
              <RbLink href="/cases?type=fire">{t('cases.linkText')}</RbLink>
            </div>
          </Container>
        </section>
      ) : null}

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="max-w-xl text-secondary-text">{t('cta.description')}</p>
          {/* CTA 仅保留单一「预约咨询」按钮（拨号/询盘入口已全局移除） */}
          <BookConsultButton message={tCommon('bookConsultContent')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </div>
      </Container>
    </div>
  );
}
