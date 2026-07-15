import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const spinnerVariants = cva('animate-spin', {
  variants: {
    variant: {
      /** shadcn/ui Spinner — https://ui.shadcn.com/docs/components/spinner */
      default: 'text-current',
      /** C 端 loading.tsx 圆环样式 */
      ring: 'rounded-full border-muted border-t-primary bg-transparent',
    },
    size: {
      sm: 'size-4',
      default: 'size-6',
      lg: 'size-8',
    },
  },
  compoundVariants: [
    { variant: 'ring', size: 'sm', className: 'border' },
    { variant: 'ring', size: 'default', className: 'border-2' },
    { variant: 'ring', size: 'lg', className: 'border-2' },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  className?: string;
} & (
    | ({ variant?: 'default' } & ComponentProps<typeof Loader2>)
    | ({ variant: 'ring' } & HTMLAttributes<HTMLDivElement>)
  );

function Spinner({ className, variant = 'default', size = 'default', ...props }: SpinnerProps) {
  if (variant === 'ring') {
    const divProps = props as HTMLAttributes<HTMLDivElement>;
    return (
      <div
        role="status"
        aria-label="Loading"
        className={cn(spinnerVariants({ variant, size }), className)}
        {...divProps}
      />
    );
  }

  const iconProps = props as ComponentProps<typeof Loader2>;
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ variant, size }), className)}
      {...iconProps}
    />
  );
}

export { Spinner, type SpinnerProps, spinnerVariants };
