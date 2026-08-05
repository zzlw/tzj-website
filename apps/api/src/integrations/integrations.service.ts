import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IntegrationAdminItem,
  IntegrationsAdminOverview,
  IntegrationTestResult,
} from '@tzj/types';
import { UpdateIntegrationDto } from '@tzj/types';
import { decryptSecrets, encryptSecrets, maskSecret } from '../common/crypto/secrets-crypto';
import { LAST_OPERATOR_USER_SELECT, mapOperatorUser } from '../common/utils/content-list';
import { PrismaService } from '../prisma/prisma.service';
import {
  AMAP_IP_LOCATION_MODES,
  getIntegrationDef,
  INFRASTRUCTURE_ENV_KEYS,
  INTEGRATION_ENV_FALLBACK,
  INTEGRATION_REGISTRY,
} from './integration.registry';
import { INTEGRATION_TESTERS } from './integration.testers';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 解析密钥：DB 加密存储优先，否则 env 兜底 */
  async resolveSecret(slug: string, fieldKey: string): Promise<string | null> {
    const row = await this.prisma.integration.findUnique({ where: { slug } });
    const encryptionKey = this.getEncryptionKeyOrNull();

    if (row?.secretsEnc && encryptionKey) {
      try {
        const secrets = decryptSecrets(row.secretsEnc, encryptionKey);
        const value = secrets[fieldKey]?.trim();
        if (value) return value;
      } catch {
        /* 解密失败则尝试 env */
      }
    }

    const envKey = INTEGRATION_ENV_FALLBACK[slug]?.secrets?.[fieldKey];
    if (envKey) {
      const value = this.config.get<string>(envKey)?.trim();
      if (value) return value;
    }
    return null;
  }

  /** 解析公开/半公开配置 */
  async resolveConfig(slug: string, fieldKey: string): Promise<string | null> {
    const row = await this.prisma.integration.findUnique({ where: { slug } });
    if (row?.config && typeof row.config === 'object') {
      const value = (row.config as Record<string, string>)[fieldKey]?.trim();
      if (value) return value;
    }

    const envKey = INTEGRATION_ENV_FALLBACK[slug]?.config?.[fieldKey];
    if (envKey) {
      const value = this.config.get<string>(envKey)?.trim();
      if (value) return value;
    }
    return null;
  }

  /** 集成是否可用（已启用且必要密钥已配置） */
  async isEnabled(slug: string): Promise<boolean> {
    return this.isActive(slug);
  }

  /**
   * 集成是否应对外生效：
   * - DB 有记录且 enabled=false → 关闭
   * - 无 DB 记录但 env 已配置 → 兼容旧部署，视为开启
   * - enabled=true 且凭证齐全 → 开启
   */
  async isActive(slug: string): Promise<boolean> {
    const def = getIntegrationDef(slug);
    if (!def) return false;

    const row = await this.prisma.integration.findUnique({ where: { slug } });
    if (row && !row.enabled) return false;

    for (const field of def.secretFields) {
      if (!field.required) continue;
      const value = await this.resolveSecret(slug, field.key);
      if (!value) return false;
    }
    for (const field of def.configFields) {
      if (!field.required) continue;
      const value = await this.resolveConfig(slug, field.key);
      if (!value) return false;
    }
    return def.secretFields.some((f) => f.required) || def.configFields.some((f) => f.required);
  }

  /** C 端可公开的集成配置（仅 registry 中 public: true 的字段） */
  async getPublicConfig(): Promise<Record<string, Record<string, string>>> {
    const result: Record<string, Record<string, string>> = {};

    for (const def of INTEGRATION_REGISTRY) {
      if (!(await this.isActive(def.slug))) continue;

      const publicConfig: Record<string, string> = {};
      for (const field of def.configFields) {
        if (!field.public) continue;
        const value = await this.resolveConfig(def.slug, field.key);
        if (value) publicConfig[field.key] = value;
      }
      if (Object.keys(publicConfig).length > 0) {
        result[def.slug] = publicConfig;
      }
    }

    return result;
  }

  async getAdminOverview(): Promise<IntegrationsAdminOverview> {
    const rows = await this.prisma.integration.findMany({
      include: {
        updatedBy: { select: LAST_OPERATOR_USER_SELECT },
      },
    });
    const rowMap = new Map(rows.map((row) => [row.slug, row]));

    const integrations: IntegrationAdminItem[] = INTEGRATION_REGISTRY.map((def) => {
      const row = rowMap.get(def.slug);
      const secretsMask = (row?.secretsMask ?? {}) as Record<string, string>;
      const config = (row?.config ?? {}) as Record<string, string>;
      const envFallback = INTEGRATION_ENV_FALLBACK[def.slug];
      const envSecretsConfigured = def.secretFields.some((field) => {
        const envKey = envFallback?.secrets?.[field.key];
        return envKey ? Boolean(this.config.get<string>(envKey)?.trim()) : false;
      });

      return {
        slug: def.slug,
        label: def.label,
        description: def.description,
        docUrl: def.docUrl,
        setupGuide: def.setupGuide,
        enabled: row?.enabled ?? false,
        config,
        secretsMask,
        secretFields: def.secretFields,
        configFields: def.configFields,
        secretsConfigured: Boolean(row?.secretsEnc),
        envFallbackActive: !row?.secretsEnc && envSecretsConfigured,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        updatedBy: mapOperatorUser(row?.updatedBy),
      };
    });

    const infrastructure = INFRASTRUCTURE_ENV_KEYS.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      configured: Boolean(this.config.get<string>(item.key)?.trim()),
    }));

    return { integrations, infrastructure };
  }

  async update(slug: string, dto: UpdateIntegrationDto, userId?: string) {
    const def = getIntegrationDef(slug);
    if (!def) throw new NotFoundException('集成不存在');

    const existing = await this.prisma.integration.findUnique({
      where: { slug },
    });

    let secretsEnc = existing?.secretsEnc ?? null;
    const secretsMask = {
      ...((existing?.secretsMask ?? {}) as Record<string, string>),
    };
    const config = {
      ...((existing?.config ?? {}) as Record<string, string>),
      ...(dto.config ?? {}),
    };

    // 高德 IP 定位接入方式：保存前校验并归一化，避免后台误填导致静默回退
    if (slug === 'amap' && config.ipLocationMode) {
      const mode = config.ipLocationMode.trim().toLowerCase();
      if (!(AMAP_IP_LOCATION_MODES as readonly string[]).includes(mode)) {
        throw new BadRequestException(
          `未知 IP 定位接入方式：${config.ipLocationMode}（可选：off / on）`,
        );
      }
      config.ipLocationMode = mode;
    }

    if (dto.secrets && Object.keys(dto.secrets).length > 0) {
      const encryptionKey = this.getEncryptionKeyOrThrow();
      let currentSecrets: Record<string, string> = {};

      if (existing?.secretsEnc) {
        try {
          currentSecrets = decryptSecrets(existing.secretsEnc, encryptionKey);
        } catch {
          currentSecrets = {};
        }
      }

      for (const [fieldKey, rawValue] of Object.entries(dto.secrets)) {
        if (!def.secretFields.some((field) => field.key === fieldKey)) {
          throw new BadRequestException(`未知密钥字段: ${fieldKey}`);
        }
        const value = rawValue.trim();
        if (!value) {
          delete currentSecrets[fieldKey];
          delete secretsMask[fieldKey];
          continue;
        }
        currentSecrets[fieldKey] = value;
        secretsMask[fieldKey] = maskSecret(value);
      }

      if (Object.keys(currentSecrets).length > 0) {
        secretsEnc = encryptSecrets(currentSecrets, encryptionKey);
      } else {
        secretsEnc = null;
      }
    }

    const enabled = dto.enabled ?? existing?.enabled ?? false;

    await this.prisma.integration.upsert({
      where: { slug },
      create: {
        slug,
        enabled,
        config,
        secretsEnc,
        secretsMask,
        updatedById: userId ?? null,
      },
      update: {
        enabled,
        config,
        secretsEnc,
        secretsMask,
        updatedById: userId ?? null,
      },
    });

    return this.getAdminOverview().then((overview) =>
      overview.integrations.find((item) => item.slug === slug),
    );
  }

  async testConnection(slug: string): Promise<IntegrationTestResult> {
    const tester = INTEGRATION_TESTERS[slug];
    if (!tester) {
      throw new NotFoundException('该集成不支持连接测试');
    }
    return tester(this);
  }

  private getEncryptionKeyOrNull(): string | null {
    const key = this.config.get<string>('SECRETS_ENCRYPTION_KEY')?.trim();
    return key && key.length >= 32 ? key : null;
  }

  private getEncryptionKeyOrThrow(): string {
    const key = this.getEncryptionKeyOrNull();
    if (!key) {
      throw new BadRequestException(
        '未配置 SECRETS_ENCRYPTION_KEY（至少 32 字符），无法保存加密凭证。请在部署环境变量中设置。',
      );
    }
    return key;
  }
}
