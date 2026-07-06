import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/MediaImage";
import { MediaVideo } from "@/components/MediaVideo";

/* ──────────────────────────────────────────────────────────
 * Container — 统一内容宽度与水平内边距
 * ────────────────────────────────────────────────────────── */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1680px] px-5 sm:px-8 lg:px-12 xl:px-16",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Eyebrow — Rosenbauer 红色 uppercase 眉标（前置短线）
 * ────────────────────────────────────────────────────────── */
export function Eyebrow({
  children,
  className,
  inverted = false,
}: {
  children: ReactNode;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]",
        inverted ? "text-white" : "text-primary-accessible",
        className,
      )}
    >
      <span className={cn("h-px w-7", inverted ? "bg-white" : "bg-primary")} />
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
 * SectionHeading — 眉标 + 流体大标题 + 可选描述
 * ────────────────────────────────────────────────────────── */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  inverted = false,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow inverted={inverted}>{eyebrow}</Eyebrow> : null}
      <h2 className={cn("rb-h2 max-w-3xl", inverted ? "text-white" : "text-neutral-900")}>
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed md:text-lg",
            inverted ? "text-white/75" : "text-secondary-text",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * PageHero — 内页统一页头（清除固定 Header 高度）
 * ────────────────────────────────────────────────────────── */
export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <section className="border-b border-neutral-300 bg-neutral-100 pt-16 lg:pt-20">
      <Container>
        <div className="flex flex-col gap-4 py-14 lg:py-20">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="rb-h1 max-w-3xl text-neutral-900">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-base leading-relaxed text-secondary-text md:text-lg">
              {description}
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * VideoHero — 视频背景页头（视频铺满，文字叠加其上）
 * 用于顶部英雄区：自动播放、静音、循环背景视频 + 深色渐变 + 白色文字。
 * ────────────────────────────────────────────────────────── */
export function VideoHero({
  eyebrow,
  title,
  description,
  video,
  poster,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  video: string;
  poster?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex min-h-[620px] items-center justify-center overflow-hidden bg-neutral-900 pt-16 lg:min-h-[720px]",
        className,
      )}
    >
      {poster ? (
        <MediaImage
          src={poster}
          alt=""
          fill
          priority
          loading="eager"
          fetchPriority="high"
          quality={90}
          sizes="100vw"
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
          aria-hidden
        />
      ) : null}
      <MediaVideo
        className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
        src={video}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
      <div className="absolute inset-0 rb-media-shade-strong" />
      <Container className="rb-on-media relative z-10 flex flex-col items-center py-16 text-center lg:py-24">
        {eyebrow ? <Eyebrow inverted>{eyebrow}</Eyebrow> : null}
        <h1 className="rb-h1 mt-5 max-w-4xl text-white">{title}</h1>
        <span className="mt-6 h-1 w-20 bg-primary" />
        {description ? (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
 * RbButton — Rosenbauer 标志性动画图标按钮
 * 右侧方形图标芯片内的箭头在悬停时滑动穿过。
 * ────────────────────────────────────────────────────────── */
type RbButtonVariant = "primary" | "secondary" | "light";

const variantStyles: Record<RbButtonVariant, { root: string; chip: string; icon: string }> = {
  primary: {
    root: "bg-primary text-white hover:bg-primary-hover",
    chip: "bg-white",
    icon: "text-primary",
  },
  secondary: {
    root: "bg-transparent text-neutral-900 outline outline-2 outline-neutral-900 hover:bg-neutral-900 hover:text-white",
    chip: "bg-neutral-900 group-hover:bg-white",
    icon: "text-white group-hover:text-neutral-900",
  },
  light: {
    root: "bg-white text-neutral-900 hover:bg-neutral-100",
    chip: "bg-primary",
    icon: "text-white",
  },
};

interface RbButtonProps {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: RbButtonVariant;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function RbButton({
  href,
  onClick,
  type = "button",
  variant = "primary",
  icon: Icon = ArrowRight,
  children,
  className,
  disabled,
}: RbButtonProps) {
  const styles = variantStyles[variant];
  const content = (
    <>
      <span className="pl-1">{children}</span>
      <span
        className={cn(
          "relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[2px] transition-colors",
          styles.chip,
        )}
      >
        <Icon
          className={cn(
            "absolute h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] group-hover:translate-x-[180%]",
            styles.icon,
          )}
        />
        <Icon
          className={cn(
            "absolute h-4 w-4 -translate-x-[180%] transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] group-hover:translate-x-0",
            styles.icon,
          )}
        />
      </span>
    </>
  );

  const rootClass = cn(
    "group inline-flex min-h-12 items-center gap-3 rounded-[2px] py-2 pl-5 pr-2 font-display text-base font-bold transition-colors duration-300",
    styles.root,
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rootClass}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={rootClass}>
      {content}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
 * RbLink — 文字链接 + 悬停滑动箭头
 * ────────────────────────────────────────────────────────── */
export function RbLink({
  href,
  children,
  className,
  inverted = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide transition-colors",
        inverted ? "text-white hover:text-white/80" : "text-primary hover:text-primary-hover",
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] group-hover:translate-x-1.5" />
    </Link>
  );
}
