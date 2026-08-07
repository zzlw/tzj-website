import {
  ClipboardList,
  Factory,
  GraduationCap,
  PencilRuler,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ProcessBand, type ProcessStep, type Stat, StatBand } from '@/components/sections/blocks';
import { PRODUCT_LINE_COUNT } from '@/lib/product-catalog';

const PROCESS_ICONS = [
  ClipboardList,
  PencilRuler,
  Factory,
  Truck,
  GraduationCap,
  ShieldCheck,
] as const;

const PROCESS_KEYS = ['survey', 'design', 'manufacture', 'install', 'training', 'service'] as const;

export async function StatBandI18n({ className }: { className?: string }) {
  const t = await getTranslations('blocks.statBand');
  const stats: Stat[] = [
    { value: '2018', label: t('founded') },
    { value: String(PRODUCT_LINE_COUNT), label: t('productLines') },
    { value: '6', label: t('domains') },
    { value: '4', label: t('families') },
  ];
  return <StatBand stats={stats} className={className} />;
}

/** 全站交钥匙默认主图；产品线可传 processImage 覆盖 */
export const SHARED_PROCESS_IMAGE = '/media/product/shared/process-turnkey.webp';

export async function ProcessBandI18n({
  image = SHARED_PROCESS_IMAGE,
  imageAlt,
  compact = false,
}: {
  image?: string;
  imageAlt?: string;
  /** 仅时间轴（无图） */
  compact?: boolean;
} = {}) {
  const t = await getTranslations('blocks.processBand');
  const steps: ProcessStep[] = PROCESS_KEYS.map((key, i) => ({
    icon: PROCESS_ICONS[i]!,
    title: t(`steps.${key}.title`),
    desc: t(`steps.${key}.desc`),
  }));
  return (
    <ProcessBand
      eyebrow={t('eyebrow')}
      title={t('title')}
      description={t('description')}
      steps={steps}
      image={image}
      imageAlt={imageAlt ?? t('imageAlt')}
      compact={compact}
      ctaLabel={t('ctaLabel')}
      ctaMessage={t('ctaMessage')}
    />
  );
}
