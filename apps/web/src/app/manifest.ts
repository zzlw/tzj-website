import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { getS3PublicDomain } from "@/lib/media-url";

const s3Base = getS3PublicDomain().replace(/\/$/, "");

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
        src: `${s3Base}/statics/favicon.ico`,
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: `${s3Base}/statics/apple-touch-icon.png`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
