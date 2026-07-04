import { MediaImage as Image } from "@/components/MediaImage";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container, SectionHeading, RbButton } from "@/components/ui";

const DELIVERY_SLUGS = [
  "henan-fire-rescue",
  "shandong-police",
  "shanxi-mine-rescue",
  "jiangsu-university",
  "zhejiang-outdoor",
  "guangdong-cfbt",
] as const;

const DELIVERY_IMAGES: Record<(typeof DELIVERY_SLUGS)[number], string> = {
  "henan-fire-rescue": "/media/tower-wylie.jpg",
  "shandong-police": "/media/tower-hamilton.jpg",
  "shanxi-mine-rescue": "/media/tower-eastside.jpg",
  "jiangsu-university": "/media/tower-macon.jpg",
  "zhejiang-outdoor": "/media/tower-denver.jpg",
  "guangdong-cfbt": "/media/tower-chino.jpg",
};

export async function DeliveriesSection() {
  const t = await getTranslations("home.deliveries");

  return (
    <section className="bg-white py-20 lg:py-28">
      <Container>
        <div className="mb-10 h-px bg-neutral-300 md:mb-12" />
        <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
          <div className="shrink-0">
            <RbButton href="/cases">{t("viewAll")}</RbButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {DELIVERY_SLUGS.map((slug) => (
            <Link
              key={slug}
              href={`/cases/${slug}`}
              className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={DELIVERY_IMAGES[slug]}
                  alt={t(`items.${slug}.title`)}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 rb-media-shade opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
                <div className="rb-on-media absolute bottom-3 left-3 flex items-center gap-1 text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {t(`items.${slug}.location`)}
                </div>
              </div>

              <div className="p-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-accessible">
                  {t(`items.${slug}.category`)}
                </span>
                <h3 className="mt-1 line-clamp-2 font-display text-sm font-bold leading-snug text-neutral-900 transition-colors group-hover:text-primary">
                  {t(`items.${slug}.title`)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
