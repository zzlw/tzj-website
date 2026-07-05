import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactSectionDynamic } from "@/components/sections/ContactSectionDynamic";
import { getSitePublicSettings, localizedAddress } from "@/lib/site-settings";

/** 首页联系区块：服务端拉取 CMS 设置后 hydrate 客户端表单 */
export async function ContactSectionLazy() {
  await connection();
  const settings = await getSitePublicSettings();
  const locale = await getLocale();
  const t = await getTranslations("contact");
  const address = localizedAddress(settings, locale, t("address"));

  return <ContactSectionDynamic settings={settings} address={address} />;
}
