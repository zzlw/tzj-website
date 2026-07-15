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
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Container, PageHero, RbButton } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

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
  return createPageMetadata({ namespace: 'pages.resources', path: '/resources' });
}

export default async function ResourcesPage() {
  const t = await getTranslations('pages.resources');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

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
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                >
                  <Icon className="h-6 w-6 text-primary" />
                  <h2 className="rb-h5 mt-4 text-neutral-900 transition-colors group-hover:text-primary">
                    {s.label}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                    {s.desc}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                    {tBlocks('learnMore')}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
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
          <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
        </div>
      </Container>
    </div>
  );
}
