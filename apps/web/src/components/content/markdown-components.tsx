import type { Components } from "react-markdown";
import { MediaImage as Image } from "@/components/MediaImage";
import { resolveMediaUrl } from "@/lib/media-url";
import { ossImageLoader } from "@/lib/oss-image-loader";
import { isExternalHref } from "@/lib/markdown";

export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="rb-h3 mt-12 text-neutral-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="rb-h4 mt-10 text-neutral-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="rb-h5 mt-8 text-neutral-900 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 text-base font-bold text-neutral-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-base leading-relaxed text-secondary-text first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-secondary-text marker:text-primary first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-5 list-decimal space-y-2 pl-5 text-base leading-relaxed text-secondary-text marker:font-semibold marker:text-neutral-900 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-neutral-900 [&>p]:mt-0 [&>p]:inline">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-l-4 border-primary pl-5 text-lg leading-relaxed text-neutral-900 first:mt-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const external = isExternalHref(href);
    return (
      <a
        href={href}
        className="font-semibold text-primary underline-offset-2 hover:underline"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-neutral-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-10 border-neutral-300" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={`block overflow-x-auto rounded-sm bg-neutral-100 p-4 text-sm ${className ?? ""}`}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-sm text-neutral-900">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-6 overflow-x-auto rounded-sm bg-neutral-100 p-4 text-sm first:mt-0">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto first:mt-0">
      <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-neutral-300 px-4 py-2 text-left font-semibold text-neutral-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-neutral-300 px-4 py-2 text-secondary-text">{children}</td>
  ),
  img: ({ src, alt }) => {
    if (!src || typeof src !== "string") return null;
    const resolved = resolveMediaUrl(src);
    const optimized = ossImageLoader({ src: resolved, width: 960, quality: 80 });
    return (
      <span className="my-8 block overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimized}
          alt={alt ?? "正文配图"}
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </span>
    );
  },
};

/** 带 next/image 优化的 Markdown 图片组件（用于需要 fill/cover 的场景） */
export const markdownImageComponents: Components = {
  ...markdownComponents,
  img: ({ src, alt }) => {
    if (!src || typeof src !== "string") return null;
    return (
      <span className="relative my-8 block aspect-[16/9] overflow-hidden bg-neutral-100">
        <Image
          src={src}
          alt={alt ?? "正文配图"}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </span>
    );
  },
};
