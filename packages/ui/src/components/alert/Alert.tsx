import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground",
        success: "border-green-500/50 text-green-400 [&>svg]:text-green-400",
        warning: "border-yellow-500/50 text-yellow-400 [&>svg]:text-yellow-400",
        destructive: "border-red-500/50 text-red-400 [&>svg]:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  icon?: "info" | "success" | "warning" | "error";
}

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
} as const;

function Alert({ className, variant, title, icon = "info", children, ...props }: AlertProps) {
  const IconComponent = iconMap[icon];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <IconComponent className="h-4 w-4" />
      {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
      {children && <div className="text-sm [&_p]:leading-relaxed">{children}</div>}
    </div>
  );
}

export { Alert, alertVariants, type AlertProps };
