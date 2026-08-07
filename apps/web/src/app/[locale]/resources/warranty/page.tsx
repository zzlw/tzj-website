import { Factory, PencilRuler, Phone, Truck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { CertificationTrustStrip } from '@/components/sections/CertificationTrustStrip';
import { Container, Eyebrow, RbLink, SectionHeading } from '@/components/ui';
import { Link as I18nLink } from '@/i18n/navigation';
import { getCases } from '@/lib/api';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { relatedLinksWithImages } from '@/lib/product-line-page';
import { RESOURCES_IMAGES } from '@/lib/resources-images';
import { getSitePublicSettings, resolveContactPhones } from '@/lib/site-settings';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesWarranty',
    path: '/resources/warranty',
    image: RESOURCES_IMAGES.warranty.og,
  });
}

const RESPONSIBILITY_ICONS = [PencilRuler, Factory, Truck] as const;
const RELATED_HREFS = ['/resources/inspections', '/resources/how-to-buy', '/resources/faqs'];

interface FeaturedCase {
  slug: string;
  title: string;
  location: string;
  summary: string;
  image: string;
}

/** 拉取企业类案例（售后与长期服务证据）；接口异常时降级为空。 */
async function fetchFeaturedCases(limit = 3): Promise<FeaturedCase[]> {
  try {
    const res = await getCases({
      type: 'enterprise',
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

export default async function WarrantyPage() {
  const t = await getTranslations('pages.resourcesWarranty');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const responsibilityRaw = t.raw('responsibility') as Array<{ title: string; desc: string }>;
  const responsibility = responsibilityRaw.map((item, i) => ({
    ...item,
    icon: RESPONSIBILITY_ICONS[i]!,
  }));
  const warrantyRows = t.raw('warrantyRows') as Array<{
    item: string;
    scope: string;
    note: string;
  }>;
  const support = t.raw('support') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const tableHeaders = t.raw('tableHeaders') as { item: string; scope: string; note: string };
  const sceneImageAlts = t.raw('sceneImageAlts') as string[];
  const [featuredCases, settings] = await Promise.all([
    fetchFeaturedCases(),
    getSitePublicSettings(),
  ]);
  // CTA 拨号按钮用主电话（后台可配置）
  const { primary: primaryPhone } = resolveContactPhones(settings);
  const phoneHref = `tel:${primaryPhone.replace(/-/g, '')}`;

  return (
    <div className="pb-20">
      <section className="relative h-[380px] overflow-hidden bg-neutral-800 lg:h-[460px]">
        <Image
          src={RESOURCES_IMAGES.warranty.hero}
          alt={t('hero.title')}
          fill
          preload
          loading="eager"
          fetchPriority="high"
          quality={90}
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 rb-media-shade-strong" />
        <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
          <Eyebrow inverted>{t('hero.eyebrow')}</Eyebrow>
          <h1 className="rb-h1 mt-4 max-w-3xl text-white">{t('hero.title')}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            {t('hero.description')}
          </p>
        </Container>
      </section>

      <CertificationTrustStrip />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('integratedSection.eyebrow')}
              title={t('integratedSection.title')}
              description={t('integratedSection.description')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {responsibility.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.title} className="border border-neutral-300 bg-white p-6 text-center">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="rb-h5 text-neutral-900">{r.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{r.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('warrantySection.eyebrow')}
            title={t('warrantySection.title')}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {tableHeaders.item}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {tableHeaders.scope}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-secondary-text">
                    {tableHeaders.note}
                  </th>
                </tr>
              </thead>
              <tbody>
                {warrantyRows.map((r) => (
                  <tr key={r.item} className="border-b border-neutral-300 align-top">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.item}</td>
                    <td className="p-4 text-sm text-neutral-900">{r.scope}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-secondary-text">{t('warrantyFootnote')}</p>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('supportSection.eyebrow')} title={t('supportSection.title')} />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {support.map((s) => (
              <li
                key={s}
                className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900"
              >
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RESOURCES_IMAGES.warranty.detailImages.map((src, i) => (
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
              <RbLink href="/cases?type=enterprise">{t('cases.linkText')}</RbLink>
            </div>
          </Container>
        </section>
      ) : null}

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BookConsultButton message={tCommon('bookConsultContent')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <a
              href={phoneHref}
              className="inline-flex items-center gap-2 border border-neutral-900 px-6 py-3 font-display text-base font-bold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {primaryPhone}
            </a>
            <RbLink href="/contact">{t('cta.inquiryLink')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
