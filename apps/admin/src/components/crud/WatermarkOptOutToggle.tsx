'use client';

import {
  cn,
  Label,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { useId } from 'react';

/**
 * 「本次上传不加水印」开关：恒显示（不依赖 settings.view 权限做状态联动），
 * 仅作用于本次选择的文件（watermark=skip），不触碰全局水印设置。
 */
export function WatermarkOptOutToggle({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={disabled}
            />
            <Label
              htmlFor={id}
              className="cursor-pointer whitespace-nowrap text-sm text-muted-foreground"
            >
              本次上传不加水印
            </Label>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          仅对本次选择的文件生效，不改变全局水印设置；全局水印未开启时，上传本就不加水印
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
