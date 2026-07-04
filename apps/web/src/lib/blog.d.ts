export interface BlogSection {
    heading?: string;
    paragraphs: string[];
    bullets?: string[];
}
export interface BlogPost {
    slug: string;
    category: string;
    title: string;
    excerpt: string;
    readTime: string;
    date: string;
    image: string;
    featured?: boolean;
    content: BlogSection[];
}
export declare const blogPosts: BlogPost[];
export declare function getBlogPostBySlug(slug: string): BlogPost | undefined;
export declare function getAllBlogSlugs(): string[];
//# sourceMappingURL=blog.d.ts.map