import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { CertificationGrid } from '@/components/sections/CertificationGrid';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { siteCoverByHref } from '@/lib/site-cover';
import { WHY_US_IMAGES } from '@/lib/why-us-images';

const RELATED_HREFS = ['/resources/warranty', '/resources/inspections', '/why-us/story'];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.whyUsCertification',
    path: '/why-us/certification',
    image: WHY_US_IMAGES.certification.og,
  });
}

export default async function CertificationPage() {
  const t = await getTranslations('pages.whyUsCertification');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const certs = t.raw('certs') as Array<{
    image: string;
    title: string;
    issuer: string;
    number: string;
    desc: string;
  }>;
  const value = t.raw('value') as Array<{ title: string; desc: string }>;
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
          src={WHY_US_IMAGES.certification.hero}
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
          <SectionHeading eyebrow={t('certsSection.eyebrow')} title={t('certsSection.title')} />
          <CertificationGrid
            certs={certs}
            viewLargeLabel={t('viewLargeLabel')}
            certNumberLabel={t('certNumberLabel')}
          />
        </Container>
      </section>
      <StatBandI18n />
      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('valueSection.eyebrow')} title={t('valueSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {value.map((v) => (
              <div key={v.title} className="border-t-2 border-primary bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{v.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => {
          const href = RELATED_HREFS[i]!;
          return {
            ...l,
            href,
            image: siteCoverByHref(href),
          };
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
