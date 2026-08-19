import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Newspaper,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { Container, PageHero } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { RESOURCES_CARD_BY_HREF, RESOURCES_IMAGES } from '@/lib/resources-images';

const SECTION_ICONS = [
  FileText,
  Ruler,
  ClipboardCheck,
  HelpCircle,
  CalendarDays,
  Newspaper,
  ShieldCheck,
  BookOpen,
] as const;

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resources',
    path: '/resources',
    image: RESOURCES_IMAGES.hub.og,
  });
}

export default async function ResourcesPage() {
  const t = await getTranslations('pages.resources');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const sections = t.raw('sections') as Array<{ label: string; href: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s, i) => {
              const Icon = SECTION_ICONS[i]!;
              const cardImage = RESOURCES_CARD_BY_HREF[s.href];
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                >
                  {cardImage ? (
                    <div className="rb-img-shimmer relative aspect-[16/10] overflow-hidden bg-neutral-200">
                      <Image
                        src={cardImage}
                        alt={s.label}
                        fill
                        {...(i < 3 ? { loading: 'eager' as const } : {})}
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center bg-primary">
                        <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                      </div>
                    </div>
                  ) : (
                    <Icon className="mt-6 ml-6 h-6 w-6 text-primary" />
                  )}
                  <div className="flex flex-1 flex-col p-6 pt-5">
                    <h2 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">
                      {s.label}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                      {s.desc}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                      {tBlocks('learnMore')}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          {/* CTA 仅保留单一「预约咨询」按钮（拨号/询盘入口已全局移除） */}
          <BookConsultButton message={tCommon('bookConsultContent')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </div>
      </Container>
    </div>
  );
}
