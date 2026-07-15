import { getTranslations } from 'next-intl/server';
import { ProductLineCard } from '@/components/products/ProductLineCard';
import { Container, SectionHeading } from '@/components/ui';
import { getLocalizedFamily, getLocalizedLines } from '@/lib/i18n/catalog';
import { PRODUCT_LINES_BY_FAMILY, type ProductFamilyId } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

const FAMILY_GRID_CLASS: Record<ProductFamilyId, string> = {
  towers: 'sm:grid-cols-2 lg:grid-cols-4',
  burn: 'sm:grid-cols-2 lg:grid-cols-3',
  specialized: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  accessories: 'max-w-xl',
};

type ProductLinesGridProps = {
  showFamilyHeaders?: boolean;
  headerVariant?: 'compact' | 'full';
  className?: string;
};

async function FamilyHeader({
  groupIndex,
  familyTitle,
  lineCount,
  description,
  variant,
}: {
  groupIndex: number;
  familyTitle: string;
  lineCount: number;
  description: string;
  variant: 'compact' | 'full';
}) {
  const t = await getTranslations('content.productGrid');

  if (variant === 'compact') {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mb-6">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">
          {t('familyIndex', { index: groupIndex + 1, total: 4 })}
        </span>
        <h3 className="font-display text-lg font-bold text-neutral-900">{familyTitle}</h3>
        <span className="text-xs font-bold text-secondary-text">
          {t('lineCount', { count: lineCount })}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-2 border-l-4 border-primary pl-4 lg:mb-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        {t('familyIndexWithCount', { index: groupIndex + 1, total: 4, count: lineCount })}
      </p>
      <h3 className="rb-h4 text-neutral-900">{familyTitle}</h3>
      <p className="max-w-2xl text-sm leading-relaxed text-secondary-text">{description}</p>
    </div>
  );
}

export async function ProductLinesGrid({
  showFamilyHeaders = false,
  headerVariant = 'full',
  className,
}: ProductLinesGridProps) {
  const groups = await Promise.all(
    PRODUCT_LINES_BY_FAMILY.map(async ({ family, lines }) => ({
      family: await getLocalizedFamily(family),
      lines: await getLocalizedLines(lines),
    })),
  );

  return (
    <div className={className}>
      {groups.map(({ family, lines }, groupIndex) => (
        <div
          key={family.id}
          id={`family-${family.id}`}
          className={
            groupIndex > 0
              ? 'mt-10 scroll-mt-below-sticky-hub border-t border-neutral-200 pt-10 lg:mt-14 lg:pt-14'
              : 'scroll-mt-below-sticky-hub'
          }
        >
          {showFamilyHeaders ? (
            <FamilyHeader
              groupIndex={groupIndex}
              familyTitle={family.title}
              lineCount={lines.length}
              description={family.description}
              variant={headerVariant}
            />
          ) : null}
          <div className={cn('grid grid-cols-1 gap-4', FAMILY_GRID_CLASS[family.id])}>
            {lines.map((line) => (
              <div
                key={line.id}
                id={showFamilyHeaders && headerVariant === 'full' ? line.anchor : undefined}
              >
                <ProductLineCard line={line} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type ProductLinesOverviewProps = {
  title?: string;
  description?: string;
  eyebrow?: string;
};

export async function ProductLinesOverview({
  eyebrow,
  title,
  description,
}: ProductLinesOverviewProps) {
  const t = await getTranslations('pages.towers');

  return (
    <Container className="py-16 lg:py-20">
      <SectionHeading
        eyebrow={eyebrow ?? t('overview.eyebrow')}
        title={title ?? t('overview.title')}
        description={description ?? t('overview.description')}
      />
      <ProductLinesGrid showFamilyHeaders headerVariant="full" className="mt-10" />
    </Container>
  );
}
