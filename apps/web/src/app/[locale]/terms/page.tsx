import { getLocale, getTranslations } from 'next-intl/server';
import { MarkdownBody } from '@/components/content/MarkdownBody';
import { Container, PageHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getLegalPage } from '@/lib/legal';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.terms', path: '/terms' });
}

export default async function TermsPage() {
  const t = await getTranslations('pages.terms');
  const locale = await getLocale();
  // 后台「法务页面」维护的 Markdown 正文优先；未维护时回退内置 i18n 静态文案
  const cms = await getLegalPage('terms', locale);

  return (
    <div className="pb-20">
      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} />
      <Container className="py-14">
        <div className="mx-auto max-w-3xl space-y-8 leading-relaxed text-secondary-text">
          {cms ? (
            <MarkdownBody content={cms.content} />
          ) : (
            <>
              {(t.raw('sections') as Array<{ title: string; body: string }>).map((s) => (
                <section key={s.title}>
                  <h2 className="rb-h5 mb-3 text-neutral-900">{s.title}</h2>
                  <p>{s.body}</p>
                </section>
              ))}

              <section>
                <h2 className="rb-h5 mb-3 text-neutral-900">{t('contactSection.title')}</h2>
                <p>{t('contactSection.intro')}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>{t('contactSection.email')}</li>
                  <li>{t('contactSection.phone')}</li>
                  <li>{t('contactSection.address')}</li>
                </ul>
              </section>
            </>
          )}

          <p className="border-t border-neutral-300 pt-6 text-xs text-neutral-500">
            {cms?.updatedAt
              ? t('lastUpdatedAt', {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                    new Date(cms.updatedAt),
                  ),
                })
              : t('lastUpdated')}
          </p>
        </div>
      </Container>
    </div>
  );
}
