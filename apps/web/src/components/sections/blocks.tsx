import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ClipboardList,
  Factory,
  GraduationCap,
  PencilRuler,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { PRODUCT_LINE_COUNT } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
 * StatBand — 数据背书带（可核验结构数据；默认与 Mission / StatBandI18n 同口径）
 * ────────────────────────────────────────────────────────── */
export interface Stat {
  value: string;
  label: string;
}

const DEFAULT_STATS: Stat[] = [
  { value: '2018', label: '年成立' },
  { value: String(PRODUCT_LINE_COUNT), label: '大产品线' },
  { value: '6', label: '大服务领域' },
  { value: '4', label: '大产品板块' },
];

export function StatBand({
  stats = DEFAULT_STATS,
  className,
}: {
  stats?: Stat[];
  className?: string;
}) {
  return (
    <section className={cn('bg-neutral-900', className)}>
      <Container className="py-14 lg:py-20">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-4xl font-bold text-white lg:text-5xl">
                {s.value}
              </div>
              <div className="mx-auto mt-3 max-w-[12rem] text-sm leading-relaxed text-white/70">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * FeatureGrid — 图标特性网格
 * ────────────────────────────────────────────────────────── */
export interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={cn('grid grid-cols-1 gap-4', colClass)}>
      {items.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.title} className="border border-neutral-300 bg-white p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="rb-h5 text-neutral-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary-text">{f.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * ProcessBand — 交钥匙服务流程（从构想到落成，及售后）
 * 默认：左图 + 右时间轴 + 区尾 CTA；compact：仅时间轴（极密页）
 * ────────────────────────────────────────────────────────── */
export interface ProcessStep {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const DEFAULT_STEPS: ProcessStep[] = [
  {
    icon: ClipboardList,
    title: '需求勘察',
    desc: '深入了解您的场地条件、训练科目、人员规模与预算，明确建设目标。',
  },
  {
    icon: PencilRuler,
    title: '方案设计',
    desc: '工程师与消防专家共同定制布局、道具与结构，兼顾真实度与合规性。',
  },
  {
    icon: Factory,
    title: '生产制造',
    desc: '工厂标准化制造，全流程质量管控，确保每个部件经久耐用。',
  },
  { icon: Truck, title: '现场安装', desc: '专业团队交钥匙安装，从基础到收尾一站式完成。' },
  { icon: GraduationCap, title: '培训交付', desc: '提供使用培训与验收，让队伍第一时间高效上手。' },
  {
    icon: ShieldCheck,
    title: '售后维保',
    desc: '长期维保、配件供应与合规检查，守护您的长期投资。',
  },
];

export function ProcessBand({
  eyebrow = '交钥匙服务',
  title = '从构想到落成，全程为您护航',
  description = '作为一体化供应商，我们把设计、制造、安装与售后集于一体——一站式对接，全程跟进。',
  steps = DEFAULT_STEPS,
  image,
  imageAlt,
  compact = false,
  ctaLabel,
  ctaMessage,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  steps?: ProcessStep[];
  /** 交钥匙服务主图；默认由 ProcessBandI18n 注入 shared 图 */
  image?: string;
  imageAlt?: string;
  /** 仅时间轴（无图），用于已很密的页面 */
  compact?: boolean;
  ctaLabel?: string;
  ctaMessage?: string;
}) {
  const showImage = Boolean(image) && !compact;

  return (
    <section className="border-y border-neutral-200 bg-white">
      <Container className="py-16 lg:py-24">
        <div
          className={cn(
            showImage && 'grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14',
          )}
        >
          {showImage ? (
            <div className="lg:col-span-5 lg:sticky lg:top-28">
              {/* fill 图的直接父级必须是 relative/absolute/fixed，sticky 放外层 */}
              <div className="rb-img-shimmer relative aspect-[4/5] overflow-hidden bg-neutral-200">
                <Image
                  src={image!}
                  alt={imageAlt ?? title}
                  fill
                  quality={75}
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}

          <div className={cn(showImage ? 'lg:col-span-7' : 'max-w-3xl')}>
            <SectionHeading eyebrow={eyebrow} title={title} description={description} />

            <ol className="mt-10">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li
                    key={s.title}
                    className="grid grid-cols-[3rem_1fr] gap-4 border-b border-neutral-200 py-5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="font-display text-2xl font-bold leading-none text-primary">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <h3 className="rb-h5 text-neutral-900">{s.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {ctaLabel ? (
              <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-8">
                <BookConsultButton message={ctaMessage}>{ctaLabel}</BookConsultButton>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * RelatedLinks — 相关页面卡片
 * ────────────────────────────────────────────────────────── */
export interface RelatedLink {
  label: string;
  href: string;
  desc?: string;
  /** 可选封面；有图时卡片上方展示 16:9 缩略图 */
  image?: string;
}

export function RelatedLinks({
  title = '延伸了解',
  eyebrow = '相关内容',
  learnMore = '了解更多',
  links,
}: {
  title?: string;
  eyebrow?: string;
  learnMore?: string;
  links: RelatedLink[];
}) {
  return (
    <section>
      <Container className="py-16 lg:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
            >
              {l.image ? (
                <div className="rb-img-shimmer relative aspect-[16/9] overflow-hidden bg-neutral-200">
                  {/* 卡图滚动后是真实 LCP 候选，且封面 URL 常与其他页面复用：
                      统一 eager 避免 next/image LCP 告警与 allImgs 同 URL lazy 覆盖冲突 */}
                  <Image
                    src={l.image}
                    alt={l.label}
                    fill
                    loading="eager"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">
                    {l.label}
                  </h3>
                  {l.desc ? (
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{l.desc}</p>
                  ) : null}
                </div>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                  {learnMore}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] group-hover:translate-x-1.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * CtaBand — 统一转化 CTA 区块
 * 主按钮走「预约咨询」智能聊天链路（在线→聊天 / 手机→拨号 / 兜底→表单）
 * ────────────────────────────────────────────────────────── */
export async function CtaBand({
  title,
  description,
  primaryLabel = '预约咨询',
  primaryMessage,
  secondaryLabel,
  secondaryHref,
  className,
}: {
  title: string;
  description?: ReactNode;
  primaryLabel?: string;
  /** 聊天面板自动发送的场景化开场消息（不传则使用通用咨询消息） */
  primaryMessage?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}) {
  const tCommon = await getTranslations('common');
  return (
    <Container className={cn('pt-16 lg:pt-24', className)}>
      <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
        <h2 className="rb-h3 text-neutral-900">{title}</h2>
        {description ? <p className="max-w-xl text-secondary-text">{description}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <BookConsultButton message={primaryMessage ?? tCommon('bookConsultGeneral')}>
            {primaryLabel}
          </BookConsultButton>
          {secondaryLabel && secondaryHref ? (
            <RbLink href={secondaryHref}>{secondaryLabel}</RbLink>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
