import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import { Spinner, type SpinnerProps } from '../spinner';

type LoadingProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  minHeight?: string;
  labelClassName?: string;
  size?: SpinnerProps['size'];
};

/** 页面/区块加载态：Spinner + 可选文案，对齐 apps/web loading.tsx */
function Loading({
  className,
  label = '加载中…',
  minHeight = 'min-h-[40vh]',
  size = 'lg',
  labelClassName,
  ...props
}: LoadingProps) {
  return (
    <div
      className={cn('flex w-full items-center justify-center py-20', minHeight, className)}
      role="status"
      aria-label={label || 'Loading'}
      {...props}
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner variant="ring" size={size} />
        {label ? (
          <p className={cn('text-sm text-muted-foreground', labelClassName)}>{label}</p>
        ) : null}
      </div>
    </div>
  );
}

export { Loading, type LoadingProps };
