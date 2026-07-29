import { Avatar, AvatarFallback, AvatarImage } from '@tzj/ui';

/* 客服头像：配置头像优先；未配置时用昵称首字 + 品牌渐变兜底 */
export function AgentAvatar({
  src,
  name,
  className,
  fallbackClassName,
}: {
  src: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const initial = name.trim().charAt(0) || '客';
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  );
}
