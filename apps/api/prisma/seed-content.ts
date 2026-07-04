/**
 * 将 C 端静态 lib 数据一次性导入数据库（不修改 C 端代码）。
 * 运行：pnpm --filter @tzj/api prisma:seed:content
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { caseStudies } from "../../web/src/lib/cases";
import { newsItems } from "../../web/src/lib/news";
import { blogPosts } from "../../web/src/lib/blog";
import {
  TRADE_SHOW_COVERS,
  patchContentImageUrls,
  resolveContentUrl,
  syncContentMedia,
} from "./lib/sync-content-media";

const prisma = new PrismaClient();

interface ContentSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

const CASE_CATEGORY_MAP: Record<string, string> = {
  消防救援: "fire",
  公安武警: "police",
  矿山救援: "enterprise",
  院校教育: "school",
  景区拓展: "scenic",
  CFBT: "fire",
};

const NEWS_TAG_MAP: Record<string, string> = {
  项目交付: "company",
  产品升级: "equipment",
  公司动态: "company",
  行业活动: "industry",
  专项能力: "knowledge",
  服务网络: "company",
};

const BLOG_CATEGORY_MAP: Record<string, string> = {
  训练设施: "training_facility",
  燃烧室技术: "burn_room",
  模块化系统: "modular",
  训练实践: "practice",
  行业洞察: "industry",
};

const TRADE_SHOWS = [
  {
    slug: "china-fire-expo",
    title: "中国国际消防设备技术交流展览会",
    location: "北京",
    eventDateLabel: "年度展会",
    summary: "展示固定与模块化训练塔、燃烧室及训练道具方案。",
    eventType: "exhibition",
    coverImage: TRADE_SHOW_COVERS[0],
  },
  {
    slug: "emergency-rescue-expo",
    title: "国际应急救援与安全博览会",
    location: "上海",
    eventDateLabel: "年度展会",
    summary: "聚焦综合应急训练基地与跨场景训练解决方案。",
    eventType: "exhibition",
    coverImage: TRADE_SHOW_COVERS[1],
  },
  {
    slug: "public-safety-expo",
    title: "公共安全与防灾减灾博览会",
    location: "广州",
    eventDateLabel: "年度展会",
    summary: "面向公安、特警与院校的战术与实战训练方案。",
    eventType: "exhibition",
    coverImage: TRADE_SHOW_COVERS[2],
  },
  {
    slug: "regional-seminar",
    title: "区域消防训练设施研讨会",
    location: "多地巡回",
    eventDateLabel: "不定期",
    summary: "与一线单位交流训练设施规划与建设经验。",
    eventType: "seminar",
    coverImage: TRADE_SHOW_COVERS[3],
  },
];

function sectionsToMarkdown(sections: ContentSection[]): string {
  return sections
    .map((section) => {
      let md = "";
      if (section.heading) {
        md += `## ${section.heading}\n\n`;
      }
      for (const p of section.paragraphs) {
        md += `${p}\n\n`;
      }
      if (section.bullets?.length) {
        for (const b of section.bullets) {
          md += `- ${b}\n`;
        }
        md += "\n";
      }
      return md;
    })
    .join("");
}

function parseYearMonth(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

async function seedCases(urlMap: Map<string, string>): Promise<number> {
  let count = 0;
  for (const [index, item] of caseStudies.entries()) {
    const coverImage = resolveContentUrl(item.image, urlMap);
    await prisma.case.upsert({
      where: { slug: item.slug },
      update: {
        coverImage,
        images: coverImage ? [coverImage] : [],
      },
      create: {
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        coverImage,
        images: coverImage ? [coverImage] : [],
        location: item.location,
        client: item.client,
        caseType: CASE_CATEGORY_MAP[item.category] ?? "enterprise",
        highlights: item.highlights,
        specs: item.specs as Prisma.InputJsonValue,
        completionDate: parseYearMonth(item.completionDate),
        status: "published",
        sortOrder: index,
        isFeatured: index === 0,
        seoTitle: item.title,
        seoDesc: item.summary,
      },
    });
    count++;
  }
  return count;
}

async function seedNews(urlMap: Map<string, string>): Promise<number> {
  let count = 0;
  const publishedAt = new Date();
  for (const [index, item] of newsItems.entries()) {
    const coverImage = resolveContentUrl(item.image, urlMap);
    await prisma.news.upsert({
      where: { slug: item.slug },
      update: {
        coverImage,
        images: coverImage ? [coverImage] : [],
      },
      create: {
        title: item.title,
        slug: item.slug,
        summary: item.desc,
        content: sectionsToMarkdown(item.content),
        coverImage,
        images: coverImage ? [coverImage] : [],
        category: NEWS_TAG_MAP[item.tag] ?? "industry",
        status: "published",
        publishedAt,
        sortOrder: index,
        isTop: index === 0,
        seoTitle: item.title,
        seoDesc: item.desc,
      },
    });
    count++;
  }
  return count;
}

async function seedBlogs(urlMap: Map<string, string>): Promise<number> {
  let count = 0;
  const publishedAt = new Date();
  for (const [index, item] of blogPosts.entries()) {
    const coverImage = resolveContentUrl(item.image, urlMap);
    await prisma.blog.upsert({
      where: { slug: item.slug },
      update: {
        coverImage,
        images: coverImage ? [coverImage] : [],
      },
      create: {
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        content: sectionsToMarkdown(item.content),
        coverImage,
        images: coverImage ? [coverImage] : [],
        category: BLOG_CATEGORY_MAP[item.category] ?? "industry",
        readTime: item.readTime,
        status: "published",
        publishedAt,
        sortOrder: index,
        isFeatured: Boolean(item.featured),
        seoTitle: item.title,
        seoDesc: item.excerpt,
      },
    });
    count++;
  }
  return count;
}

async function seedTradeShows(urlMap: Map<string, string>): Promise<number> {
  let count = 0;
  const publishedAt = new Date();
  for (const [index, item] of TRADE_SHOWS.entries()) {
    const { coverImage: rawCover, ...rest } = item;
    const coverImage = resolveContentUrl(rawCover, urlMap);
    await prisma.tradeShow.upsert({
      where: { slug: item.slug },
      update: {
        coverImage,
        images: coverImage ? [coverImage] : [],
      },
      create: {
        ...rest,
        coverImage,
        images: coverImage ? [coverImage] : [],
        status: "published",
        publishedAt,
        sortOrder: index,
        seoTitle: item.title,
        seoDesc: item.summary,
      },
    });
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  console.log("📦 导入 C 端静态内容到数据库…");

  const urlMap = await syncContentMedia(prisma);

  const [cases, news, blogs, tradeShows] = await Promise.all([
    seedCases(urlMap),
    seedNews(urlMap),
    seedBlogs(urlMap),
    seedTradeShows(urlMap),
  ]);

  await patchContentImageUrls(prisma, urlMap);

  console.log(`   ✅ 案例 ${cases}、新闻 ${news}、博客 ${blogs}、展会 ${tradeShows}`);
  console.log(`   ✅ 媒体库已登记 ${urlMap.size} 张内容图片`);
}

main()
  .catch((e: unknown) => {
    console.error("❌ 内容导入失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
