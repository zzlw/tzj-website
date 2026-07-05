import { BadRequestException, Injectable } from "@nestjs/common";
import type { SitePublicSettings, SiteNotificationSettings, SiteMediaSettings } from "@tzj/types";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_SITE_PUBLIC_SETTINGS,
  mergeSitePublicSettings,
  normalizeSocialChannel,
  normalizeSocialQrPath,
  SITE_PUBLIC_SETTING_KEY,
} from "./settings.defaults";
import {
  DEFAULT_SITE_NOTIFICATION_SETTINGS,
  mergeSiteNotificationSettings,
  SITE_NOTIFICATIONS_SETTING_KEY,
} from "./settings-notifications.defaults";
import {
  DEFAULT_SITE_MEDIA_SETTINGS,
  mergeSiteMediaSettings,
  normalizeWatermarkImageKey,
  SITE_MEDIA_SETTING_KEY,
} from "./settings-media.defaults";
import { sitePublicSettingsSchema } from "./settings.schema";
import { siteNotificationSettingsSchema } from "./settings-notifications.schema";
import { siteMediaSettingsSchema } from "./settings-media.schema";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSitePublicSettings(): Promise<SitePublicSettings> {
    const row = await this.prisma.setting.findUnique({
      where: { key: SITE_PUBLIC_SETTING_KEY },
    });
    if (!row?.value) return DEFAULT_SITE_PUBLIC_SETTINGS;
    return mergeSitePublicSettings(row.value as Partial<SitePublicSettings>);
  }

  async updateSitePublicSettings(raw: unknown): Promise<SitePublicSettings> {
    const parsed = sitePublicSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const publicDomain = this.config.get<string>(
      "S3_PUBLIC_DOMAIN",
      "http://localhost:9000/tzj-uploads-dev",
    );

    const value: SitePublicSettings = {
      ...(parsed.data as SitePublicSettings),
      social: {
        channels: (parsed.data as SitePublicSettings).social.channels.map((c) =>
          normalizeSocialChannel({
            ...c,
            qr: normalizeSocialQrPath(c.qr, publicDomain),
          }),
        ),
      },
    };

    await this.prisma.setting.upsert({
      where: { key: SITE_PUBLIC_SETTING_KEY },
      create: {
        key: SITE_PUBLIC_SETTING_KEY,
        group: "site",
        label: "官网公开设置",
        sortOrder: 0,
        value: value as object,
      },
      update: {
        value: value as object,
      },
    });

    return value;
  }

  async getSiteNotificationSettings(): Promise<SiteNotificationSettings> {
    const row = await this.prisma.setting.findUnique({
      where: { key: SITE_NOTIFICATIONS_SETTING_KEY },
    });
    if (!row?.value) return DEFAULT_SITE_NOTIFICATION_SETTINGS;
    return mergeSiteNotificationSettings(row.value as Partial<SiteNotificationSettings>);
  }

  async updateSiteNotificationSettings(raw: unknown): Promise<SiteNotificationSettings> {
    const parsed = siteNotificationSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const value = parsed.data as SiteNotificationSettings;

    await this.prisma.setting.upsert({
      where: { key: SITE_NOTIFICATIONS_SETTING_KEY },
      create: {
        key: SITE_NOTIFICATIONS_SETTING_KEY,
        group: "site",
        label: "邮件通知设置",
        sortOrder: 1,
        value: value as object,
      },
      update: {
        value: value as object,
      },
    });

    return value;
  }

  async getSiteMediaSettings(): Promise<SiteMediaSettings> {
    const row = await this.prisma.setting.findUnique({
      where: { key: SITE_MEDIA_SETTING_KEY },
    });
    if (!row?.value) return DEFAULT_SITE_MEDIA_SETTINGS;
    return mergeSiteMediaSettings(row.value as Partial<SiteMediaSettings>);
  }

  async updateSiteMediaSettings(raw: unknown): Promise<SiteMediaSettings> {
    const parsed = siteMediaSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const publicDomain = this.config.get<string>(
      "S3_PUBLIC_DOMAIN",
      "http://localhost:9000/tzj-uploads-dev",
    );
    const imageKey = normalizeWatermarkImageKey(
      parsed.data.watermark.imageKey,
      publicDomain,
    );

    const value: SiteMediaSettings = {
      watermark: {
        ...(parsed.data.watermark as SiteMediaSettings["watermark"]),
        text: parsed.data.watermark.text.trim(),
        imageKey,
      },
    };

    await this.prisma.setting.upsert({
      where: { key: SITE_MEDIA_SETTING_KEY },
      create: {
        key: SITE_MEDIA_SETTING_KEY,
        group: "site",
        label: "媒体处理设置",
        sortOrder: 2,
        value: value as object,
      },
      update: {
        value: value as object,
      },
    });

    return value;
  }

  async seedSiteNotificationSettings(): Promise<void> {
    const existing = await this.prisma.setting.findUnique({
      where: { key: SITE_NOTIFICATIONS_SETTING_KEY },
    });
    if (existing) return;

    await this.prisma.setting.create({
      data: {
        key: SITE_NOTIFICATIONS_SETTING_KEY,
        group: "site",
        label: "邮件通知设置",
        sortOrder: 1,
        value: DEFAULT_SITE_NOTIFICATION_SETTINGS as object,
      },
    });
  }

  /** 初始化默认设置（seed / 首次部署） */
  async seedSitePublicSettings(): Promise<void> {
    const existing = await this.prisma.setting.findUnique({
      where: { key: SITE_PUBLIC_SETTING_KEY },
    });
    if (existing) return;

    await this.prisma.setting.create({
      data: {
        key: SITE_PUBLIC_SETTING_KEY,
        group: "site",
        label: "官网公开设置",
        sortOrder: 0,
        value: DEFAULT_SITE_PUBLIC_SETTINGS as object,
      },
    });
  }
}
