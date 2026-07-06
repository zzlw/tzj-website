import Link from "next/link";
import { MediaImage as Image } from "@/components/MediaImage";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui";

const CARDS = [
  {
    title: "固定训练塔",
    desc: "标准塔型与深度定制，最坚固耐用的固定式训练塔",
    href: "/fixed-tower",
    image: "/media/fixed-tower-hero.jpg",
  },
  {
    title: "模块化训练塔",
    desc: "全镀锌钢框架，开放式平面，可堆叠扩展",
    href: "/modular-tower",
    image: "/media/modular-hero.jpg",
  },
  {
    title: "燃烧室",
    desc: "互锁隔热衬里系统，耐高温、低维护",
    href: "/burn-rooms",
    image: "/media/burn-room.webp",
  },
  {
    title: "训练配件与道具",
    desc: "热与烟、逃生、搜救、破拆、危化品等全场景道具",
    href: "/accessories",
    image: "/media/tactical.jpg",
  },
];

export function QuickLinksSection() {
  return (
    <section id="products" className="scroll-mt-24 bg-white py-12 lg:py-16">
      <Container>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card, i) => (
            <Link
              key={card.title}
              href={card.href}
              className="group relative aspect-[16/10] overflow-hidden bg-neutral-900 sm:aspect-[16/11]"
            >
              <Image
                src={card.image}
                alt={card.title}
                fill
                quality={70}
                priority={i === 0}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 rb-media-shade" />
              <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
              <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center overflow-hidden bg-primary">
                <ArrowRight className="h-4 w-4 -translate-x-[150%] text-white transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] group-hover:translate-x-0" />
              </div>
              <div className="rb-on-media absolute inset-0 flex flex-col justify-end p-5">
                <h3 className="rb-h5 leading-tight text-white">{card.title}</h3>
                <p className="mt-1 text-sm text-white/85">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
