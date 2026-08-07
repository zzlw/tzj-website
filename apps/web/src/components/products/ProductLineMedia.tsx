import { MediaImage as Image } from '@/components/MediaImage';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import type { FeaturedCaseCard } from '@/lib/product-line-page';

export function ProductHeroBand({ src, alt }: { src: string; alt: string }) {
  return (
    <section>
      <Container className="pt-16 lg:pt-24">
        <div className="rb-img-shimmer relative aspect-[21/9] overflow-hidden bg-neutral-200">
          <Image
            src={src}
            alt={alt}
            fill
            preload
            loading="eager"
            fetchPriority="high"
            quality={90}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </Container>
    </section>
  );
}

export function ProductGallery({
  items,
  fallbackSrc,
}: {
  items: Array<{ src: string; alt: string }>;
  fallbackSrc: string;
}) {
  return (
    <section>
      <Container className="pt-4 lg:pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((g) => (
            <div
              key={g.src + g.alt}
              className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200"
            >
              <Image
                src={g.src || fallbackSrc}
                alt={g.alt}
                fill
                quality={70}
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FeatureImageGrid({
  items,
  columns = 3,
}: {
  items: Array<{ id: string; title: string; desc: string; src: string }>;
  columns?: 2 | 3;
}) {
  const colClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`mt-10 grid grid-cols-1 gap-4 ${colClass}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col overflow-hidden border border-neutral-300 bg-white"
        >
          <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
            <Image
              src={item.src}
              alt={item.title}
              fill
              quality={70}
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
          <div className="p-5">
            <h3 className="rb-h5 text-neutral-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary-text">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsersBand({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  users,
}: {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt: string;
  users: string[];
}) {
  return (
    <section className="bg-neutral-100">
      <Container className="py-16 lg:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
          {imageSrc ? (
            <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                quality={75}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap content-center gap-3">
            {users.map((u) => (
              <span
                key={u}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function CasesBand({
  eyebrow,
  title,
  description,
  linkText,
  cases,
}: {
  eyebrow: string;
  title: string;
  description: string;
  linkText: string;
  cases: FeaturedCaseCard[];
}) {
  if (!cases.length) return null;
  return (
    <section>
      <Container className="py-16 lg:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cases.map((item) => (
            <Link
              key={item.slug}
              href={`/cases/${item.slug}`}
              className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
            >
              <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="p-5">
                {item.location ? (
                  <p className="text-xs font-bold tracking-wide text-primary">{item.location}</p>
                ) : null}
                <h3 className="rb-h5 mt-2 text-neutral-900">{item.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                  {item.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <RbLink href="/cases">{linkText}</RbLink>
        </div>
      </Container>
    </section>
  );
}
