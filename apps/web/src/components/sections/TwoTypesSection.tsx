import { Check } from 'lucide-react';
import { Container, RbButton, SectionHeading } from '@/components/ui';

const TYPES = [
  {
    tag: '模块化',
    title: '模块化训练塔',
    href: '/modular-tower',
    points: [
      '热浸镀锌钢框架，性能优于集装箱',
      '外置结构支撑，实现开放式平面',
      '门、窗、墙体可互换',
      '安装、运输与场地成本更低',
      '无需结构改造即可扩展/堆叠',
      '燃烧室可承受高达 1100°C 高温',
    ],
    cta: '查看模块化系列',
  },
  {
    tag: '固定式',
    title: '固定训练塔',
    href: '/fixed-tower',
    points: [
      '外部加肋并螺栓紧固的镀锌钢板墙体',
      '15 套建筑设计可选并深度定制',
      '燃烧室内无明火布置限制',
      '开放式平面，预留重组与扩建燃烧室的空间',
      '8 种不同屋面形式',
      '8 种配色方案',
    ],
    cta: '查看固定塔系列',
  },
];

export function TwoTypesSection() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow="代代相传"
          title="我们打造两种超耐用燃烧训练塔"
          description="标准型号与深度定制，由消防人为消防人打造 —— 比集装箱改造更逼真、更耐用。"
        />
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {TYPES.map((t) => (
            <div
              key={t.title}
              className="flex flex-col border border-neutral-300 bg-neutral-100 p-8 lg:p-10"
            >
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {t.tag}
              </span>
              <h3 className="rb-h3 mt-2 text-neutral-900">{t.title}</h3>
              <ul className="mt-6 flex-1 space-y-3">
                {t.points.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm leading-relaxed text-neutral-900">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <RbButton href={t.href} variant="secondary">
                  {t.cta}
                </RbButton>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
