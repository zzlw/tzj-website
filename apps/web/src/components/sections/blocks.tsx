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
import type { ReactNode } from 'react';
import { Container, RbButton, RbLink, SectionHeading } from '@/components/ui';
import { PRODUCT_LINE_COUNT } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
 * StatBand — 数据背书带（默认使用拓之迹真实数据）
 * ────────────────────────────────────────────────────────── */
export interface Stat {
  value: string;
  label: string;
}

const DEFAULT_STATS: Stat[] = [
  { value: '16', label: '年深耕应急救援训练装备' },
  { value: '1000+', label: '训练基地案例' },
  { value: String(PRODUCT_LINE_COUNT), label: '大产品线' },
  { value: '6', label: '大服务领域' },
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
  description = '作为一体化供应商，我们把设计、制造、安装与售后集于一体——单一对接，责任到底。',
  steps = DEFAULT_STEPS,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  steps?: ProcessStep[];
}) {
  return (
    <section className="bg-neutral-100">
      <Container className="py-16 lg:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="relative border border-neutral-300 bg-white p-6">
                <span className="absolute right-4 top-4 font-display text-2xl font-bold text-neutral-200">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="rb-h5 text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </li>
            );
          })}
        </ol>
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
              className="group flex flex-col justify-between border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
            >
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
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * CtaBand — 统一转化 CTA 区块
 * ────────────────────────────────────────────────────────── */
export function CtaBand({
  title,
  description,
  primaryLabel = '预约咨询',
  primaryHref = '/contact',
  secondaryLabel,
  secondaryHref,
  className,
}: {
  title: string;
  description?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}) {
  return (
    <Container className={cn('pt-16 lg:pt-24', className)}>
      <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
        <h2 className="rb-h3 text-neutral-900">{title}</h2>
        {description ? <p className="max-w-xl text-secondary-text">{description}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <RbButton href={primaryHref}>{primaryLabel}</RbButton>
          {secondaryLabel && secondaryHref ? (
            <RbLink href={secondaryHref}>{secondaryLabel}</RbLink>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
