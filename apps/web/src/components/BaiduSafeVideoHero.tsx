import { isBaiduAppUserAgent } from '@tzj/device';
import { headers } from 'next/headers';
import type { ComponentProps } from 'react';
import { VideoHero } from '@/components/ui';

type BaiduSafeVideoHeroProps = Omit<ComponentProps<typeof VideoHero>, 'posterOnly'>;

/**
 * 百度 App 安全版 VideoHero（仅服务端）。
 *
 * 百度 App 会对页面中的 <video> 做「视频嗅探」并弹出播放条/浮层，干扰背景视频。
 * 业内通行做法：UA 命中 baiduboxapp 时，服务端直接不输出 <video>，
 * 仅渲染 poster 封面图——比客户端隐藏/延迟挂载更彻底，从源头避免嗅探。
 */
export async function BaiduSafeVideoHero(props: BaiduSafeVideoHeroProps) {
  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') ?? '';
  return <VideoHero {...props} posterOnly={isBaiduAppUserAgent(userAgent)} />;
}
