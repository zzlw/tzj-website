import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { getSitePublicSettings } from "@/lib/site-settings";
import { resolveSocialChannels } from "@/lib/resolve-social-channels";

/**
 * 导航区壳组件（Server Component）
 * 负责拉取站点设置并解析社媒渠道，将数据注入 Header（Client Component）。
 */
export async function HeaderShell() {
  const settings = await getSitePublicSettings();
  const tContact = await getTranslations("contact");

  const socialChannels = resolveSocialChannels(
    settings,
    undefined,
    (key) => tContact(key as Parameters<typeof tContact>[0]),
  );
  const scanHint = tContact("scanToFollow");

  return (
    <Header
      topBarPhone={settings.contact.phone}
      topBarEmail={settings.contact.email}
      topBarSocialChannels={socialChannels}
      topBarScanHint={scanHint}
    />
  );
}
