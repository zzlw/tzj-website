'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MediaImage as Image } from '@/components/MediaImage';
import type { ProductLine } from '@/lib/product-catalog';

type ProductLineCardProps = {
  line: ProductLine;
  /** compact：概览矩阵；default：分区详情 */
  variant?: 'compact' | 'default';
};

export function ProductLineCard({ line, variant = 'default' }: ProductLineCardProps) {
  const t = useTranslations('cta');
  const indexLabel = String(line.index).padStart(2, '0');

  if (variant === 'compact') {
    return (
      <Link
        href={line.href}
        className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
      >
        <div className="rb-img-shimmer-dark relative aspect-[4/3] overflow-hidden bg-neutral-900">
          <Image
            src={line.image}
            alt={line.title}
            fill
            quality={70}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 rb-media-shade" />
          <span className="absolute left-4 top-4 flex h-9 min-w-9 items-center justify-center bg-primary px-2 font-display text-sm font-bold text-white">
            {indexLabel}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="rb-h5 leading-snug text-white">{line.title}</h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-secondary-text">
            {line.description}
          </p>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={line.href}
      className="group flex h-full flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
    >
      <div className="rb-img-shimmer-dark relative aspect-[16/10] overflow-hidden bg-neutral-900">
        <Image
          src={line.image}
          alt={line.title}
          fill
          quality={70}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 rb-media-shade opacity-80" />
        <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
        <span className="absolute left-5 top-5 flex h-10 min-w-10 items-center justify-center bg-primary px-2 font-display text-sm font-bold text-white">
          {indexLabel}
        </span>
        <h3 className="absolute bottom-5 left-5 right-5 font-display text-xl font-bold leading-tight text-white md:text-2xl">
          {line.title}
        </h3>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="flex-1 text-sm leading-relaxed text-secondary-text">{line.description}</p>
        {line.subLinks && line.subLinks.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
            {line.subLinks.map((sub) => (
              <li key={sub.href}>
                <span className="border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                  {sub.title}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          {t('learnMore')}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
        </span>
      </div>
    </Link>
  );
}
