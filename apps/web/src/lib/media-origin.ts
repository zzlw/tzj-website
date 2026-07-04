import { getS3PublicDomain } from "./media-url";

/** 媒体 CDN / MinIO 源站 origin，用于 preconnect。 */
export function getMediaOrigin(): string {
  try {
    return new URL(getS3PublicDomain()).origin;
  } catch {
    return getS3PublicDomain();
  }
}
