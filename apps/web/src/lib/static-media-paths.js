"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADE_SHOW_COVERS = void 0;
exports.isSiteStaticMediaPath = isSiteStaticMediaPath;
exports.collectSiteStaticMediaPaths = collectSiteStaticMediaPaths;
const blog_1 = require("./blog");
const cases_1 = require("./cases");
const news_1 = require("./news");
const product_catalog_1 = require("./product-catalog");
const solutions_1 = require("./solutions");
const EXTRA_SITE_MEDIA_PATHS = [
    "/media/alarm-1st.png",
    "/media/alarm-3rd.png",
    "/media/alarm-5th.png",
    "/media/alarm-highrise.jpg",
    "/media/burn-room.mp4",
    "/media/fixed-series.mp4",
    "/media/fixed-tower-hero.jpg",
    "/media/fixed-tower.mp4",
    "/media/hero.mp4",
    "/media/louisville-case.mp4",
    "/media/maritime-jacksonville.jpg",
    "/media/maritime-miami.jpg",
    "/media/mission.mp4",
    "/media/modular-d.png",
    "/media/modular-m.jpg",
    "/media/modular-o.png",
    "/media/modular-tower.mp4",
    "/media/modular-x.png",
    "/media/tower-ocean-springs.jpg",
    "/media/tower-prairieville.jpg",
    "/media/whp-hero.mp4",
    "/media/why.mp4",
    "/og-default.jpg",
    "/favicon.ico",
    "/apple-touch-icon.png",
];
exports.TRADE_SHOW_COVERS = [
    "/media/tower-wylie.jpg",
    "/media/modular-hero.jpg",
    "/media/burn-room.webp",
    "/media/tactical.jpg",
];
const SECTION_MEDIA_PATHS = [
    "/media/hero.mp4",
    "/media/fixed-tower-hero.jpg",
    "/media/mission.mp4",
    "/media/modular-construction.jpg",
];
const QUICK_LINK_IMAGES = [
    "/media/fixed-tower-hero.jpg",
    "/media/modular-hero.jpg",
    "/media/burn-room.webp",
    "/media/tactical.jpg",
];
function isSiteStaticMediaPath(url) {
    return url.startsWith("/media/") || /^\/og-/.test(url) || url === "/favicon.ico" || url === "/apple-touch-icon.png";
}
function collectSiteStaticMediaPaths() {
    const set = new Set([
        ...EXTRA_SITE_MEDIA_PATHS,
        ...exports.TRADE_SHOW_COVERS,
        ...SECTION_MEDIA_PATHS,
        ...QUICK_LINK_IMAGES,
    ]);
    const add = (value) => {
        const trimmed = value?.trim();
        if (trimmed && isSiteStaticMediaPath(trimmed))
            set.add(trimmed);
    };
    for (const item of cases_1.caseStudies)
        add(item.image);
    for (const item of news_1.newsItems)
        add(item.image);
    for (const item of blog_1.blogPosts)
        add(item.image);
    for (const line of product_catalog_1.PRODUCT_LINES)
        add(line.image);
    for (const meta of solutions_1.SOLUTION_META)
        add(meta.image);
    return [...set].sort();
}
//# sourceMappingURL=static-media-paths.js.map