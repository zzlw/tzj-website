import { getTranslations } from 'next-intl/server';
import { LazyMediaVideo } from '@/components/LazyMediaVideo';
import { AnimatedStat } from '@/components/sections/AnimatedStat';
import { Container, Eyebrow, RbLink } from '@/components/ui';
import { PRODUCT_LINE_COUNT } from '@/lib/product-catalog';

const MISSION_VIDEO = '/media/mission.mp4';
const MISSION_POSTER = '/media/modular-construction.jpg';

export async function MissionSection() {
  const t = await getTranslations('home.mission');

  const stats = [
    { value: '2018', label: t('statFounded'), duration: 0 },
    { value: String(PRODUCT_LINE_COUNT), label: t('statLines') },
    { value: '6', label: t('statDomains') },
    { value: '4', label: t('statFamilies') },
  ];

  return (
    <section
      id="mission"
      className="relative flex min-h-[620px] items-center justify-center overflow-hidden bg-neutral-900 py-20 lg:min-h-[720px] lg:py-28"
    >
      <LazyMediaVideo
        className="absolute inset-0 h-full w-full object-cover object-center"
        src={MISSION_VIDEO}
        poster={MISSION_POSTER}
        autoPlay
        muted
        loop
        playsInline
        lazy
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 rb-media-shade-strong" aria-hidden="true" />

      <Container className="rb-on-media relative z-10 flex flex-col items-center text-center">
        <Eyebrow inverted>{t('eyebrow')}</Eyebrow>

        <h2 className="rb-h2 mt-6 max-w-3xl text-white">
          {t('titleLine1')}
          <br />
          {t('titleLine2')}
          <span className="text-primary">{t('titleHighlight')}</span>
        </h2>

        <span className="mt-6 h-1 w-20 bg-primary" aria-hidden="true" />

        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-6 border-t border-white/20 pt-10 md:grid-cols-4">
          {stats.map((stat) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              label={stat.label}
              duration={'duration' in stat ? stat.duration : undefined}
            />
          ))}
        </div>

        <div className="mt-10">
          <RbLink href="/why-us" inverted>
            {t('learnMore')}
          </RbLink>
        </div>
      </Container>
    </section>
  );
}
