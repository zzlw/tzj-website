import type { SiteNotificationSettings } from "@tzj/types";
import { DEFAULT_SITE_PUBLIC_SETTINGS } from "./settings.defaults";

export const SITE_NOTIFICATIONS_SETTING_KEY = "site.notifications";

export const DEFAULT_SITE_NOTIFICATION_SETTINGS: SiteNotificationSettings = {
  enabled: true,
  contact: {
    notifyEmails: [DEFAULT_SITE_PUBLIC_SETTINGS.contact.email],
    autoReplyEnabled: true,
  },
};

export function mergeSiteNotificationSettings(
  partial?: Partial<SiteNotificationSettings> | null,
): SiteNotificationSettings {
  if (!partial) return DEFAULT_SITE_NOTIFICATION_SETTINGS;
  return {
    enabled: partial.enabled ?? DEFAULT_SITE_NOTIFICATION_SETTINGS.enabled,
    contact: {
      ...DEFAULT_SITE_NOTIFICATION_SETTINGS.contact,
      ...partial.contact,
      notifyEmails:
        partial.contact?.notifyEmails?.length
          ? partial.contact.notifyEmails.map((e) => e.trim()).filter(Boolean)
          : DEFAULT_SITE_NOTIFICATION_SETTINGS.contact.notifyEmails,
    },
  };
}
