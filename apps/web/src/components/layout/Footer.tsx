import { Mail, MapPin, Phone } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { SocialChannelBar } from '@/components/contact/SocialChannelBar';
import { FooterLanguageTrigger } from '@/components/i18n/FooterLanguageTrigger';
import { MediaImage as Image } from '@/components/MediaImage';
import { Container, Eyebrow, RbLink } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { resolveMediaUrl } from '@/lib/media-url';
import { FOOTER_BLOCKS } from '@/lib/navigation';
import { resolveSocialChannels } from '@/lib/resolve-social-channels';
import { getSitePublicSettings, localizedAddress } from '@/lib/site-settings';

export async function Footer() {
  const tNav = await getTranslations('nav');
  const tFooter = await getTranslations('footer');
  const tContact = await getTranslations('contact');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const settings = await getSitePublicSettings();
  const address = localizedAddress(settings, locale, tContact('address'));
  const contactChannels = resolveSocialChannels(settings, 'contact', (key) =>
    tContact(key as Parameters<typeof tContact>[0]),
  );
  const followChannels = resolveSocialChannels(settings, 'follow', (key) =>
    tContact(key as Parameters<typeof tContact>[0]),
  );

  return (
    <footer className="bg-white">
      <div className="grid lg:grid-cols-2">
        <div className="rb-img-shimmer-dark relative flex min-h-[360px] flex-col justify-center overflow-hidden bg-neutral-900 px-5 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16">
          <Image
            src="/media/fixed-tower-hero.jpg"
            alt=""
            fill
            loading="lazy"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 rb-media-shade-strong" aria-hidden="true" />
          <div className="rb-on-media relative z-10 max-w-md">
            <Eyebrow inverted>{tFooter('ctaEyebrow')}</Eyebrow>
            <h2 className="rb-h2 mt-4 text-white">{tFooter('ctaTitle')}</h2>
            <p className="mt-4 text-base leading-relaxed text-white/85">{tFooter('ctaDesc')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <BookConsultButton variant="light" message={tCommon('bookConsultFooter')}>
                {tFooter('ctaButton')}
              </BookConsultButton>
              <RbLink href="/cases" inverted>
                {tFooter('ctaLink')}
              </RbLink>
            </div>
          </div>
        </div>

        <div className="bg-white px-5 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 xl:grid-cols-4">
            {FOOTER_BLOCKS.map((block) => (
              <div key={block.titleKey}>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
                  {tFooter(block.titleKey as Parameters<typeof tFooter>[0])}
                </div>
                <ul className="mt-4 space-y-3">
                  {block.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={link.href}
                        className="font-display text-base font-bold text-neutral-900 transition-colors hover:text-primary"
                      >
                        {tNav(link.key as Parameters<typeof tNav>[0])}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-300">
        <Container>
          <div className="flex flex-col gap-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-secondary-text">
                <a
                  href={`tel:${settings.contact.phone.replace(/-/g, '')}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {settings.contact.phone}
                </a>
                <a
                  href={`mailto:${settings.contact.email}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {settings.contact.email}
                </a>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {address}
                </span>
              </div>

              {contactChannels.length > 0 ? (
                <SocialChannelBar
                  sectionLabel={tContact('instantContact')}
                  scanHint={tContact('scanToAdd')}
                  channels={contactChannels}
                />
              ) : null}
            </div>

            {followChannels.length > 0 ? (
              <SocialChannelBar
                sectionLabel={tContact('followUs')}
                scanHint={tContact('scanToFollow')}
                channels={followChannels}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary-text lg:justify-end">
              <FooterLanguageTrigger />
              <Link href="/privacy" className="transition-colors hover:text-primary">
                {tFooter('privacy')}
              </Link>
              <Link href="/terms" className="transition-colors hover:text-primary">
                {tFooter('terms')}
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <div className="border-t border-neutral-300 bg-neutral-100">
        <Container>
          <div className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-neutral-500 md:flex-row">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center bg-primary font-display text-sm font-extrabold text-white">
                  TZ
                </span>
                <span>
                  &copy; {new Date().getFullYear()} {tCommon('legalName')} {tFooter('copyright')}
                </span>
              </div>
              <span>{tFooter('creditCode')}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a
                href={settings.legal.beianUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {settings.legal.beian}
              </a>
              {settings.legal.gonganBeian ? (
                <a
                  href={
                    settings.legal.gonganBeianUrl || 'https://beian.mps.gov.cn/#/query/webSearch'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                >
                  <img
                    src={resolveMediaUrl('/media/gongan.png')}
                    alt=""
                    width={15}
                    height={17}
                    className="h-4 w-auto"
                  />
                  {settings.legal.gonganBeian}
                </a>
              ) : null}
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
