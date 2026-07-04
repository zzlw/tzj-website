#!/usr/bin/env node
/**
 * Batch-complete i18n for remaining web pages.
 * Run: node scripts/complete-i18n-pages.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = 'apps/web/src';
const APP = path.join(ROOT, 'app/[locale]');

function writeJson(id, zhCN, en, zhTW) {
  for (const [locale, data] of [['zh-CN', zhCN], ['en', en], ['zh-TW', zhTW]]) {
    fs.writeFileSync(
      path.join(ROOT, `messages/${locale}/pages/${id}.json`),
      JSON.stringify(data, null, 2) + '\n',
    );
  }
}

function writePage(relPath, content) {
  fs.writeFileSync(path.join(APP, relPath), content);
}

// ─── education-center ───
writeJson(
  'education-center',
  {
    meta: { title: '科普教育馆', description: '拓之迹消防科普教育馆 —— 沉浸式消防安全科普体验空间，服务院校教学与公众安全教育。' },
    hero: { eyebrow: '训练塔与建筑 · 科普教育', title: '消防科普教育馆', description: '把安全知识变成可体验、可记忆的实景——面向院校与公众，打造寓教于练的沉浸式科普空间。', imageAlt: '科普教育馆' },
    breadcrumb: { parent: '训练塔与建筑', current: '科普教育馆' },
    jsonLd: { productName: '科普教育馆', productDescription: '沉浸式消防安全科普体验空间，服务院校教学与公众安全教育。' },
    overview: { eyebrow: '寓教于练', title: '让安全教育不再枯燥', description: '传统安全教育停留在说教，科普教育馆则用实景、互动与体验，让参观者在动手中真正记住如何预防与自救。', lead: '从认知到体验，我们按主题规划展陈动线，串联起完整的安全教育闭环。', body: '可与训练塔、模拟设施衔接，形成「科普 + 实训」一体化基地，服务院校与区域公众。' },
    featuresSection: { eyebrow: '核心特色', title: '科普教育馆的六大特色' },
    features: [
      { title: '沉浸式体验', desc: '以实景与互动装置还原火灾、逃生等场景，让安全知识可看、可触、可体验。' },
      { title: '分区主题展陈', desc: '按火灾预防、逃生自救、器材使用等主题分区，动线清晰、循序渐进。' },
      { title: '面向多类受众', desc: '适配学生、企业员工与公众，支持团体参观与分组体验教学。' },
      { title: '安全可控', desc: '以模拟与互动为主，环境安全可控，适合大规模、常态化开放。' },
      { title: '数字互动', desc: '可集成多媒体、体感与数字互动装置，提升参与感与传播力。' },
      { title: '寓教于练', desc: '与训练设施衔接，从科普认知过渡到实操体验，教育闭环。' },
    ],
    zonesSection: { eyebrow: '展区规划', title: '典型展陈与体验分区' },
    zones: ['火灾成因与预防认知区', '家庭 / 公共场所隐患查找区', '灭火器材操作体验区', '浓烟逃生与疏散体验通道', '结绳、报警与自救互动区', '消防历史与英雄人物展陈区'],
    relatedLinks: [
      { label: '消防模拟训练设施', desc: '安全可控的模拟教学设施。' },
      { label: '院校教育解决方案', desc: '面向院校的教学实训整体方案。' },
      { label: '标准塔型系列', desc: '预设塔型，教学实训快速落地。' },
    ],
    cta: { title: '打造属于您的科普教育馆', description: '告诉我们您的场地与教育目标，我们将为您规划从展陈到互动的整体方案。' },
  },
  {
    meta: { title: 'Fire Safety Education Center', description: 'TZJ fire safety education centers—immersive public fire safety experience spaces for schools and community education.' },
    hero: { eyebrow: 'Training Towers · Education', title: 'Fire Safety Education Center', description: 'Turn safety knowledge into memorable, hands-on experiences—for schools and the public.', imageAlt: 'Fire safety education center' },
    breadcrumb: { parent: 'Training Towers', current: 'Education Center' },
    jsonLd: { productName: 'Fire Safety Education Center', productDescription: 'Immersive fire safety education space for schools and public programs.' },
    overview: { eyebrow: 'Learn by doing', title: 'Safety education that engages', description: 'Move beyond lectures with real environments, interaction, and experience that help visitors remember prevention and self-rescue.', lead: 'Themed exhibit paths connect awareness to experience in a complete education loop.', body: 'Integrates with training towers and simulation for a combined public education and hands-on training base.' },
    featuresSection: { eyebrow: 'Key features', title: 'Six hallmarks of our education centers' },
    features: [
      { title: 'Immersive experience', desc: 'Realistic scenes and interactive exhibits make fire and escape knowledge tangible.' },
      { title: 'Themed zones', desc: 'Prevention, escape, and equipment zones with clear visitor flow.' },
      { title: 'Multiple audiences', desc: 'Students, workforce, and public groups with tour and group formats.' },
      { title: 'Safe and controlled', desc: 'Simulation-based, safe for large-scale routine public access.' },
      { title: 'Digital interaction', desc: 'Multimedia and interactive technology for engagement and outreach.' },
      { title: 'Education to practice', desc: 'Links to training facilities for a full awareness-to-practice loop.' },
    ],
    zonesSection: { eyebrow: 'Exhibit planning', title: 'Typical zones and experiences' },
    zones: ['Fire cause and prevention', 'Home and public hazard identification', 'Extinguisher operation', 'Smoke escape corridor', 'Knot tying, alarm, and self-rescue', 'Fire service history and heroes'],
    relatedLinks: [
      { label: 'Fire simulation systems', desc: 'Safe, controlled simulation training.' },
      { label: 'Education solutions', desc: 'Integrated programs for schools.' },
      { label: 'Standard tower series', desc: 'Preset towers for rapid deployment.' },
    ],
    cta: { title: 'Build your education center', description: 'Share your site and education goals—we will plan exhibits and interaction end to end.' },
  },
  {
    meta: { title: '科普教育館', description: '拓之跡消防科普教育館 —— 沉浸式消防安全科普體驗空間，服務院校教學與公眾安全教育。' },
    hero: { eyebrow: '訓練塔與建築 · 科普教育', title: '消防科普教育館', description: '把安全知識變成可體驗、可記憶的實景——面向院校與公眾，打造寓教於練的沉浸式科普空間。', imageAlt: '科普教育館' },
    breadcrumb: { parent: '訓練塔與建築', current: '科普教育館' },
    jsonLd: { productName: '科普教育館', productDescription: '沉浸式消防安全科普體驗空間，服務院校教學與公眾安全教育。' },
    overview: { eyebrow: '寓教於練', title: '讓安全教育不再枯燥', description: '傳統安全教育停留在說教，科普教育館則用實景、互動與體驗，讓參觀者在動手中真正記住如何預防與自救。', lead: '從認知到體驗，我們按主題規劃展陳動線，串聯起完整的安全教育閉環。', body: '可與訓練塔、模擬設施銜接，形成「科普 + 實訓」一體化基地，服務院校與區域公眾。' },
    featuresSection: { eyebrow: '核心特色', title: '科普教育館的六大特色' },
    features: [
      { title: '沉浸式體驗', desc: '以實景與互動裝置還原火災、逃生等場景，讓安全知識可看、可觸、可體驗。' },
      { title: '分區主題展陳', desc: '按火災預防、逃生自救、器材使用等主題分區，動線清晰、循序漸進。' },
      { title: '面向多類受眾', desc: '適配學生、企業員工與公眾，支持團體參觀與分組體驗教學。' },
      { title: '安全可控', desc: '以模擬與互動為主，環境安全可控，適合大規模、常態化開放。' },
      { title: '數字互動', desc: '可集成多媒體、體感與數字互動裝置，提升參與感與傳播力。' },
      { title: '寓教於練', desc: '與訓練設施銜接，從科普認知過渡到實操體驗，教育閉環。' },
    ],
    zonesSection: { eyebrow: '展區規劃', title: '典型展陳與體驗分區' },
    zones: ['火災成因與預防認知區', '家庭 / 公共場所隱患查找區', '滅火器材操作體驗區', '濃煙逃生與疏散體驗通道', '結繩、報警與自救互動區', '消防歷史與英雄人物展陳區'],
    relatedLinks: [
      { label: '消防模擬訓練設施', desc: '安全可控的模擬教學設施。' },
      { label: '院校教育解決方案', desc: '面向院校的教學實訓整體方案。' },
      { label: '標準塔型系列', desc: '預設塔型，教學實訓快速落地。' },
    ],
    cta: { title: '打造屬於您的科普教育館', description: '告訴我們您的場地與教育目標，我們將為您規劃從展陳到互動的整體方案。' },
  },
);

writePage(
  'education-center/page.tsx',
  `import { Check } from "lucide-react";
import { GraduationCap, Eye, Users, ShieldCheck, Sparkles, BookOpen } from "lucide-react";
import { MediaImage as Image } from "@/components/MediaImage";
import { getTranslations } from "next-intl/server";
import { productJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, Eyebrow, SectionHeading } from "@/components/ui";
import { FeatureGrid, RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";

const IMAGE = "/media/tower-macon.jpg";
const FEATURE_ICONS = [Eye, BookOpen, Users, ShieldCheck, Sparkles, GraduationCap] as const;
const RELATED_HREFS = ["/burn-rooms/fire-simulation", "/solutions/education", "/fixed-tower/series"];

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.educationCenter", path: "/education-center" });
}

export default async function EducationCenterPage() {
  const t = await getTranslations("pages.educationCenter");
  const tCta = await getTranslations("cta");
  const tBread = await getTranslations("breadcrumbs");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const featuresRaw = t.raw("features") as Array<{ title: string; desc: string }>;
  const features = featuresRaw.map((item, i) => ({ ...item, icon: FEATURE_ICONS[i]! }));
  const zones = t.raw("zones") as string[];
  const relatedLinks = t.raw("relatedLinks") as Array<{ label: string; desc: string }>;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread("home"), path: "/" },
            { name: t("breadcrumb.parent"), path: "/towers" },
            { name: t("breadcrumb.current"), path: "/education-center" },
          ]),
          productJsonLd({
            name: t("jsonLd.productName"),
            description: t("jsonLd.productDescription"),
            path: "/education-center",
            image: IMAGE,
          }),
        ]}
      />
      <div className="pb-20">
        <section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[500px]">
          <Image src={IMAGE} alt={t("hero.imageAlt")} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 rb-media-shade-strong" />
          <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
            <Eyebrow inverted>{t("hero.eyebrow")}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-3xl text-white">{t("hero.title")}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">{t("hero.description")}</p>
          </Container>
        </section>
        <section>
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <SectionHeading eyebrow={t("overview.eyebrow")} title={t("overview.title")} description={t("overview.description")} />
              <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
                <p className="text-lg leading-relaxed text-neutral-900">{t("overview.lead")}</p>
                <p className="text-secondary-text">{t("overview.body")}</p>
              </div>
            </div>
          </Container>
        </section>
        <section className="bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading eyebrow={t("featuresSection.eyebrow")} title={t("featuresSection.title")} />
            <div className="mt-10"><FeatureGrid items={features} columns={3} /></div>
          </Container>
        </section>
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading eyebrow={t("zonesSection.eyebrow")} title={t("zonesSection.title")} />
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zones.map((z) => (
                <li key={z} className="flex items-start gap-3 border border-neutral-300 bg-white p-5">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-neutral-900">{z}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>
        <StatBandI18n />
        <ProcessBandI18n />
        <RelatedLinks title={tBlocks("titleDefault")} learnMore={tBlocks("learnMore")} eyebrow={tBlocks("eyebrow")} links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))} />
        <CtaBand title={t("cta.title")} description={t("cta.description")} primaryLabel={tCta("bookConsult")} />
      </div>
    </>
  );
}
`,
);

console.log('education-center done');
