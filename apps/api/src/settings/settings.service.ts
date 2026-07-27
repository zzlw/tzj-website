import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SecurityAuthSettings,
  SiteMediaSettings,
  SiteNotificationSettings,
  SitePublicSettings,
} from '@tzj/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SITE_PUBLIC_SETTINGS,
  mergeSitePublicSettings,
  normalizeSocialChannel,
  normalizeSocialQrPath,
  SITE_PUBLIC_SETTING_KEY,
} from './settings.defaults';
import { sitePublicSettingsSchema } from './settings.schema';
import {
  DEFAULT_SITE_MEDIA_SETTINGS,
  mergeSiteMediaSettings,
  normalizeWatermarkImageKey,
  SITE_MEDIA_SETTING_KEY,
} from './settings-media.defaults';
import { siteMediaSettingsSchema } from './settings-media.schema';
import {
  DEFAULT_SITE_NOTIFICATION_SETTINGS,
  mergeSiteNotificationSettings,
  SITE_NOTIFICATIONS_SETTING_KEY,
} from './settings-notifications.defaults';
import { siteNotificationSettingsSchema } from './settings-notifications.schema';
import {
  DEFAULT_SECURITY_AUTH_SETTINGS,
  mergeSecurityAuthSettings,
  SECURITY_AUTH_SETTING_KEY,
} from './settings-security.defaults';
import { securityAuthSettingsSchema } from './settings-security.schema';

/** 安全策略开关缓存 TTL：守卫每请求读取，必须缓存（默认态下未绑定用户走常态读取路径） */
const SECURITY_AUTH_CACHE_TTL_MS = 30_000;

const AUDIT = {
  POLICY_ENABLED: '2fa_policy_enabled',
  POLICY_DISABLED: '2fa_policy_disabled',
} as const;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  /** security.auth 内存缓存（单实例前提，与 2FA 主方案 §6.4 同口径） */
  private securityAuthCache: { value: SecurityAuthSettings; expiresAt: number } | null = null;

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
      'S3_PUBLIC_DOMAIN',
      'http://localhost:9000/tzj-uploads-dev',
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
        group: 'site',
        label: '官网公开设置',
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
        group: 'site',
        label: '邮件通知设置',
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
      'S3_PUBLIC_DOMAIN',
      'http://localhost:9000/tzj-uploads-dev',
    );
    const imageKey = normalizeWatermarkImageKey(parsed.data.watermark.imageKey, publicDomain);

    const value: SiteMediaSettings = {
      watermark: {
        ...(parsed.data.watermark as SiteMediaSettings['watermark']),
        text: parsed.data.watermark.text.trim(),
        imageKey,
      },
    };

    await this.prisma.setting.upsert({
      where: { key: SITE_MEDIA_SETTING_KEY },
      create: {
        key: SITE_MEDIA_SETTING_KEY,
        group: 'site',
        label: '媒体处理设置',
        sortOrder: 2,
        value: value as object,
      },
      update: {
        value: value as object,
      },
    });

    return value;
  }

  /** 读取安全策略开关（强制 2FA）；供守卫每请求调用，带 30s 内存缓存 */
  async getSecurityAuthSettings(): Promise<SecurityAuthSettings> {
    const now = Date.now();
    if (this.securityAuthCache && this.securityAuthCache.expiresAt > now) {
      return this.securityAuthCache.value;
    }
    const row = await this.prisma.setting.findUnique({
      where: { key: SECURITY_AUTH_SETTING_KEY },
    });
    const value = row?.value
      ? mergeSecurityAuthSettings(row.value as Partial<SecurityAuthSettings>)
      : DEFAULT_SECURITY_AUTH_SETTINGS;
    this.securityAuthCache = { value, expiresAt: now + SECURITY_AUTH_CACHE_TTL_MS };
    return value;
  }

  /**
   * 更新安全策略开关（admin 专属）。
   * 置 true 时要求操作者自身已启用 2FA（防「立法者自己违法」，对齐 GitHub 组织强制 2FA 前置）；
   * 值实际变化时写语义化审计（2fa_policy_enabled / 2fa_policy_disabled）。
   */
  async updateSecurityAuthSettings(
    raw: unknown,
    actor: { id: string; ip?: string; userAgent?: string; traceId?: string },
  ): Promise<SecurityAuthSettings> {
    const parsed = securityAuthSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const next: SecurityAuthSettings = parsed.data;

    if (next.twoFactorRequired) {
      const operator = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { twoFactorEnabled: true },
      });
      if (!operator?.twoFactorEnabled) {
        throw new BadRequestException('请先为自己启用两步验证，再强制全员开启');
      }
    }

    const prev = await this.getSecurityAuthSettings();

    await this.prisma.setting.upsert({
      where: { key: SECURITY_AUTH_SETTING_KEY },
      create: {
        key: SECURITY_AUTH_SETTING_KEY,
        group: 'security',
        label: '安全策略设置',
        sortOrder: 0,
        value: next as unknown as object,
      },
      update: {
        value: next as unknown as object,
      },
    });
    // 本实例缓存立即失效，开关变更即刻生效
    this.securityAuthCache = { value: next, expiresAt: Date.now() + SECURITY_AUTH_CACHE_TTL_MS };

    if (prev.twoFactorRequired !== next.twoFactorRequired) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: next.twoFactorRequired ? AUDIT.POLICY_ENABLED : AUDIT.POLICY_DISABLED,
            resource: 'settings',
            resourceId: SECURITY_AUTH_SETTING_KEY,
            ip: actor.ip,
            userAgent: actor.userAgent?.slice(0, 512),
            traceId: actor.traceId,
          },
        });
      } catch (e) {
        this.logger.warn(`审计日志写入失败: ${(e as Error).message}`);
      }
    }

    return next;
  }
}
