import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  // flex 布局：图标 16px vs 首行 text-sm 行高 20px，translate-y-0.5 补 2px 使二者垂直居中对齐
  // （旧版 absolute top-4 + pl-7 方案在无 title 的单行提示下图标会偏低）
  'relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-surface text-foreground',
        success: 'border-success/50 text-success [&>svg]:text-success',
        warning: 'border-warning/50 text-warning [&>svg]:text-warning',
        destructive: 'border-destructive/50 text-destructive [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  icon?: 'info' | 'success' | 'warning' | 'error';
}

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
} as const;

function Alert({ className, variant, title, icon = 'info', children, ...props }: AlertProps) {
  const IconComponent = iconMap[icon];
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <IconComponent className="h-4 w-4" />
      <div className="min-w-0 flex-1">
        {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
        {children && <div className="text-sm [&_p]:leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export { Alert, type AlertProps, alertVariants };
