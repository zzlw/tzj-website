import { getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { resolveSocialChannels } from '@/lib/resolve-social-channels';
import { getSitePublicSettings, resolveContactPhones } from '@/lib/site-settings';

/**
 * 导航区壳组件（Server Component）
 * 负责拉取站点设置并解析社媒渠道，将数据注入 Header（Client Component）。
 */
export async function HeaderShell() {
  const settings = await getSitePublicSettings();
  const tContact = await getTranslations('contact');

  const socialChannels = resolveSocialChannels(settings, undefined, (key) =>
    tContact(key as Parameters<typeof tContact>[0]),
  );
  const scanHint = tContact('scanToFollow');
  // 双号码展示：主电话在前，备用电话在后（备用留空则不展示）
  const { primary, secondary } = resolveContactPhones(settings);
  const topBarPhones = secondary ? [primary, secondary] : [primary];

  return (
    <Header
      topBarPhones={topBarPhones}
      topBarEmail={settings.contact.email}
      topBarSocialChannels={socialChannels}
      topBarScanHint={scanHint}
    />
  );
}
