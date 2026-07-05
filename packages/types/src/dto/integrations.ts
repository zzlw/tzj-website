/** 集成字段定义（密钥或公开配置） */
export interface IntegrationFieldDef {
  key: string;
  label: string;
  description?: string;
  /** 该字段的官方文档或控制台链接 */
  helpUrl?: string;
  /** 会暴露在前端的配置项（如验证码 sceneId） */
  public?: boolean;
  required?: boolean;
}

/** 配置教程步骤（content 支持 [链接文字](https://...) 语法） */
export interface IntegrationSetupStep {
  title: string;
  content: string;
}

/** 集成注册表项（代码定义，非 DB） */
export interface IntegrationDef {
  slug: string;
  label: string;
  description: string;
  /** 官方文档或产品首页 */
  docUrl?: string;
  /** 分步配置教程，展示在后台集成卡片中 */
  setupGuide?: IntegrationSetupStep[];
  secretFields: IntegrationFieldDef[];
  configFields: IntegrationFieldDef[];
}

/** 后台展示的掩码凭证 */
export interface IntegrationSecretMask {
  [fieldKey: string]: string;
}

/** 集成操作人（Hover 展示资料卡） */
export interface IntegrationOperatorUser {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** 后台集成项（含脱敏凭证与来源） */
export interface IntegrationAdminItem {
  slug: string;
  label: string;
  description: string;
  docUrl?: string;
  setupGuide?: IntegrationSetupStep[];
  enabled: boolean;
  config: Record<string, string>;
  secretsMask: IntegrationSecretMask;
  secretFields: IntegrationFieldDef[];
  configFields: IntegrationFieldDef[];
  /** 密钥是否已在 DB 加密存储 */
  secretsConfigured: boolean;
  /** 是否从环境变量兜底（DB 未配置时） */
  envFallbackActive: boolean;
  /** 最后一次保存时间（未保存过则为 null） */
  updatedAt: string | null;
  /** 最后一次保存的操作人 */
  updatedBy: IntegrationOperatorUser | null;
}

/** 基础设施级 env 密钥（只读状态） */
export interface InfrastructureSecretStatus {
  key: string;
  label: string;
  description: string;
  configured: boolean;
}

export interface IntegrationsAdminOverview {
  integrations: IntegrationAdminItem[];
  infrastructure: InfrastructureSecretStatus[];
}

/** 更新集成（secrets 仅传需变更的字段，空串表示清除） */
export interface UpdateIntegrationDto {
  enabled?: boolean;
  config?: Record<string, string>;
  secrets?: Record<string, string>;
}

export interface IntegrationTestResult {
  ok: boolean;
  message: string;
}

/** C 端公开集成配置（仅含 public 字段，如 Turnstile siteKey） */
export type IntegrationsPublicConfig = Record<string, Record<string, string>>;
