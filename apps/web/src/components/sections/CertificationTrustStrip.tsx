'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MediaImage } from '@/components/MediaImage';

const CERTS = [
  { key: 'iso9001', image: '/media/cert-iso9001.webp' },
  { key: 'iso14001', image: '/media/cert-iso14001.webp' },
  { key: 'iso45001', image: '/media/cert-iso45001.webp' },
  { key: 'aftersales', image: '/media/cert-after-sales-5star.webp' },
] as const;

/** 产品线页轻量资质信任条：证书缩略图 + 名称，点击进入资质认证页。 */
export function CertificationTrustStrip() {
  const t = useTranslations('blocks.certificationTrust');

  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-2.5 md:justify-start md:px-8 lg:px-12 xl:px-16">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-text">
          {t('label')}
        </span>
        {CERTS.map((cert) => (
          <Link
            key={cert.key}
            href="/why-us/certification"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 transition-colors hover:text-primary"
          >
            <span className="relative h-8 w-6 shrink-0 overflow-hidden bg-white">
              <MediaImage
                src={cert.image}
                alt={t(`items.${cert.key}`)}
                fill
                sizes="24px"
                className="object-contain"
              />
            </span>
            {t(`items.${cert.key}`)}
          </Link>
        ))}
      </div>
    </div>
  );
}
