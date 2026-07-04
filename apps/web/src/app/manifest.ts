import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { resolveMediaUrl } from "@/lib/media-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.legalName,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e3000f",
    lang: "zh-CN",
    icons: [
      {
        src: resolveMediaUrl("/favicon.ico"),
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: resolveMediaUrl("/apple-touch-icon.png"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
