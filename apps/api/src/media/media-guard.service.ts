import { Injectable } from "@nestjs/common";
import type { MediaAsset } from "@prisma/client";
import { collectSiteStaticMediaPaths } from "./site-static-paths";
import { PrismaService } from "../prisma/prisma.service";

/** 站点同步静态资源目录，禁止普通上传写入。 */
export const PROTECTED_MEDIA_FOLDERS = new Set(["content"]);

/** 站点资源备份前缀（不可通过普通上传写入）。 */
export const SITE_ARCHIVE_PREFIX = "content/_archive/";

export type MediaReferenceType =
  | "case"
  | "news"
  | "blog"
  | "tradeShow"
  | "page";

export interface MediaReference {
  type: MediaReferenceType;
  id: string;
  title: string;
  field: string;
}

export interface MediaGuardReport {
  isSiteResource: boolean;
  isProtected: boolean;
  references: MediaReference[];
  usageCount: number;
}

@Injectable()
export class MediaGuardService {
  private staticPaths: Set<string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getStaticPaths(): Set<string> {
    if (!this.staticPaths) {
      this.staticPaths = new Set(collectSiteStaticMediaPaths());
    }
    return this.staticPaths;
  }

  /** 素材在站点上可能出现的 Web 路径变体（/media/*、根目录资源等）。 */
  webPathVariants(asset: Pick<MediaAsset, "key" | "url">): string[] {
    const variants = new Set<string>();
    variants.add(asset.url);
    variants.add(asset.key);

    if (asset.key.startsWith("content/")) {
      const rest = asset.key.slice("content/".length);
      variants.add(`/media/${rest}`);
      if (!rest.includes("/")) {
        variants.add(`/${rest}`);
      }
    }

    return [...variants];
  }

  isSiteResourceFolder(folder: string): boolean {
    return PROTECTED_MEDIA_FOLDERS.has(folder);
  }

  /** 固定 key 的站点静态资源（content/hero.mp4 等，非带时间戳的上传）。 */
  isStaticSiteAsset(asset: Pick<MediaAsset, "key" | "url">): boolean {
    if (!asset.key.startsWith("content/")) return false;
    const rest = asset.key.slice("content/".length);
    if (!rest || rest.includes("/") || rest.startsWith("_archive")) return false;
    const staticPaths = this.getStaticPaths();
    return staticPaths.has(`/media/${rest}`) || staticPaths.has(`/${rest}`);
  }

  isInStaticManifest(asset: Pick<MediaAsset, "key" | "url" | "folder">): boolean {
    return this.isStaticSiteAsset(asset);
  }

  private textReferencesAsset(
    text: string | null | undefined,
    asset: Pick<MediaAsset, "key" | "url">,
  ): boolean {
    if (!text?.trim()) return false;
    const haystack = text;
    for (const needle of this.webPathVariants(asset)) {
      if (haystack.includes(needle)) return true;
    }
    return false;
  }

  private arrayReferencesAsset(
    values: string[],
    asset: Pick<MediaAsset, "key" | "url">,
  ): boolean {
    return values.some((v) => this.textReferencesAsset(v, asset));
  }

  async findReferences(
    asset: Pick<MediaAsset, "id" | "key" | "url" | "folder">,
  ): Promise<MediaReference[]> {
    const refs: MediaReference[] = [];

    const [cases, news, blogs, tradeShows, pages] = await Promise.all([
      this.prisma.case.findMany({
        select: {
          id: true,
          title: true,
          coverImage: true,
          images: true,
          description: true,
        },
      }),
      this.prisma.news.findMany({
        select: {
          id: true,
          title: true,
          coverImage: true,
          images: true,
          content: true,
        },
      }),
      this.prisma.blog.findMany({
        select: {
          id: true,
          title: true,
          coverImage: true,
          images: true,
          content: true,
        },
      }),
      this.prisma.tradeShow.findMany({
        select: {
          id: true,
          title: true,
          coverImage: true,
          images: true,
          content: true,
        },
      }),
      this.prisma.page.findMany({
        select: { id: true, title: true, coverImage: true, content: true },
      }),
    ]);

    for (const row of cases) {
      if (this.textReferencesAsset(row.coverImage, asset)) {
        refs.push({ type: "case", id: row.id, title: row.title, field: "coverImage" });
      }
      if (this.arrayReferencesAsset(row.images, asset)) {
        refs.push({ type: "case", id: row.id, title: row.title, field: "images" });
      }
      if (this.textReferencesAsset(row.description, asset)) {
        refs.push({ type: "case", id: row.id, title: row.title, field: "description" });
      }
    }

    for (const row of news) {
      if (this.textReferencesAsset(row.coverImage, asset)) {
        refs.push({ type: "news", id: row.id, title: row.title, field: "coverImage" });
      }
      if (this.arrayReferencesAsset(row.images, asset)) {
        refs.push({ type: "news", id: row.id, title: row.title, field: "images" });
      }
      if (this.textReferencesAsset(row.content, asset)) {
        refs.push({ type: "news", id: row.id, title: row.title, field: "content" });
      }
    }

    for (const row of blogs) {
      if (this.textReferencesAsset(row.coverImage, asset)) {
        refs.push({ type: "blog", id: row.id, title: row.title, field: "coverImage" });
      }
      if (this.arrayReferencesAsset(row.images, asset)) {
        refs.push({ type: "blog", id: row.id, title: row.title, field: "images" });
      }
      if (this.textReferencesAsset(row.content, asset)) {
        refs.push({ type: "blog", id: row.id, title: row.title, field: "content" });
      }
    }

    for (const row of tradeShows) {
      if (this.textReferencesAsset(row.coverImage, asset)) {
        refs.push({
          type: "tradeShow",
          id: row.id,
          title: row.title,
          field: "coverImage",
        });
      }
      if (this.arrayReferencesAsset(row.images, asset)) {
        refs.push({ type: "tradeShow", id: row.id, title: row.title, field: "images" });
      }
      if (this.textReferencesAsset(row.content, asset)) {
        refs.push({ type: "tradeShow", id: row.id, title: row.title, field: "content" });
      }
    }

    for (const row of pages) {
      if (this.textReferencesAsset(row.coverImage, asset)) {
        refs.push({ type: "page", id: row.id, title: row.title, field: "coverImage" });
      }
      if (this.textReferencesAsset(row.content, asset)) {
        refs.push({ type: "page", id: row.id, title: row.title, field: "content" });
      }
    }

    return refs;
  }

  async inspect(
    asset: Pick<MediaAsset, "id" | "key" | "url" | "folder">,
  ): Promise<MediaGuardReport> {
    const isSiteResource = this.isInStaticManifest(asset);
    const references = isSiteResource ? [] : await this.findReferences(asset);
    const usageCount = references.length;
    return {
      isSiteResource,
      isProtected: isSiteResource || usageCount > 0,
      references,
      usageCount,
    };
  }

  /** 批量 enrich 当前页素材（单次 CMS 扫描，避免 N+1）。 */
  async enrichMany(
    assets: MediaAsset[],
  ): Promise<
    (MediaAsset & {
      isSiteResource: boolean;
      isProtected: boolean;
      usageCount: number;
      isReplaceable: boolean;
    })[]
  > {
    if (assets.length === 0) return [];

    const cmsRows = await this.loadCmsRowsForScan();

    return assets.map((asset) => {
      const isSiteResource = this.isStaticSiteAsset(asset);
      if (isSiteResource) {
        return {
          ...asset,
          isSiteResource: true,
          isProtected: true,
          usageCount: 0,
          isReplaceable: true,
        };
      }
      const usageCount = this.countReferencesInRows(asset, cmsRows);
      return {
        ...asset,
        isSiteResource: false,
        isProtected: usageCount > 0,
        usageCount,
        isReplaceable: false,
      };
    });
  }

  private async loadCmsRowsForScan() {
    const [cases, news, blogs, tradeShows, pages] = await Promise.all([
      this.prisma.case.findMany({
        select: {
          coverImage: true,
          images: true,
          description: true,
        },
      }),
      this.prisma.news.findMany({
        select: { coverImage: true, images: true, content: true },
      }),
      this.prisma.blog.findMany({
        select: { coverImage: true, images: true, content: true },
      }),
      this.prisma.tradeShow.findMany({
        select: { coverImage: true, images: true, content: true },
      }),
      this.prisma.page.findMany({
        select: { coverImage: true, content: true },
      }),
    ]);
    return { cases, news, blogs, tradeShows, pages };
  }

  private countReferencesInRows(
    asset: Pick<MediaAsset, "key" | "url">,
    rows: Awaited<ReturnType<MediaGuardService["loadCmsRowsForScan"]>>,
  ): number {
    let count = 0;
    for (const row of rows.cases) {
      if (
        this.textReferencesAsset(row.coverImage, asset) ||
        this.arrayReferencesAsset(row.images, asset) ||
        this.textReferencesAsset(row.description, asset)
      ) {
        count++;
      }
    }
    for (const row of rows.news) {
      if (
        this.textReferencesAsset(row.coverImage, asset) ||
        this.arrayReferencesAsset(row.images, asset) ||
        this.textReferencesAsset(row.content, asset)
      ) {
        count++;
      }
    }
    for (const row of rows.blogs) {
      if (
        this.textReferencesAsset(row.coverImage, asset) ||
        this.arrayReferencesAsset(row.images, asset) ||
        this.textReferencesAsset(row.content, asset)
      ) {
        count++;
      }
    }
    for (const row of rows.tradeShows) {
      if (
        this.textReferencesAsset(row.coverImage, asset) ||
        this.arrayReferencesAsset(row.images, asset) ||
        this.textReferencesAsset(row.content, asset)
      ) {
        count++;
      }
    }
    for (const row of rows.pages) {
      if (
        this.textReferencesAsset(row.coverImage, asset) ||
        this.textReferencesAsset(row.content, asset)
      ) {
        count++;
      }
    }
    return count;
  }
}
