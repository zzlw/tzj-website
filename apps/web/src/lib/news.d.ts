export interface NewsSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}
export interface NewsItem {
  slug: string;
  tag: string;
  title: string;
  date: string;
  desc: string;
  image: string;
  content: NewsSection[];
}
export declare const newsItems: NewsItem[];
export declare function getNewsBySlug(slug: string): NewsItem | undefined;
export declare function getAllNewsSlugs(): string[];
//# sourceMappingURL=news.d.ts.map
