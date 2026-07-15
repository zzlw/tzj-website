import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/** shadcn FormDescription — 字段说明/提示文案。 */
const FieldDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-xs leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  ),
);
FieldDescription.displayName = 'FieldDescription';

export { FieldDescription };
