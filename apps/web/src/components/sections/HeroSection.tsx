import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MediaImage } from '@/components/MediaImage';
import { MediaVideo } from '@/components/MediaVideo';
import { Container, Eyebrow, RbButton } from '@/components/ui';
import { PRODUCT_LINE_COUNT } from '@/lib/product-catalog';

const HERO_VIDEO = '/media/hero.mp4';
const HERO_POSTER = '/media/fixed-tower-hero.jpg';

export async function HeroSection() {
  const t = await getTranslations('home.hero');

  return (
    <section className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-neutral-900">
      {/* LCP：优先加载 poster 图（视频 Hero 的行业标准做法） */}
      <MediaImage
        src={HERO_POSTER}
        alt=""
        fill
        preload
        loading="eager"
        fetchPriority="high"
        quality={90}
        sizes="100vw"
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        aria-hidden
      />
      {/* poster 留给底层 eager <img> 承担，避免 <video poster> 的原始 URL
          与 allImgs 中 eager 图片的 ?w= 键不匹配导致 LCP 误报 */}
      <MediaVideo
        className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
        src={HERO_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <span className="select-none font-display text-[18rem] font-extrabold leading-none tracking-tighter text-white/[0.06] md:text-[26rem] lg:text-[32rem]">
          TZ
        </span>
      </div>

      <div className="absolute inset-0 z-10 rb-media-shade-strong" aria-hidden="true" />

      <Container className="rb-on-media relative z-20 pb-16 pt-28 md:pb-20">
        <Eyebrow inverted>{t('eyebrow')}</Eyebrow>

        <h1 className="rb-display mt-6 max-w-4xl text-white">
          {t('titleLine1')}
          <br />
          <span className="text-primary">{t('titleLine2')}</span>
        </h1>

        <p className="mt-6 mb-9 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
          {t('description', { count: PRODUCT_LINE_COUNT })}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <RbButton href="#products">{t('browseProducts')}</RbButton>
          <Link
            href="/solutions"
            className="group inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors hover:text-white/80"
          >
            {t('viewSolutions')}
            <ChevronDown
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1"
              aria-hidden="true"
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
