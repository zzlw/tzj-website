/**
 * 第三方集成注册表 — 新增集成只需改本文件 + integration.testers.ts
 *
 * 步骤：
 * 1. 在 INTEGRATION_REGISTRY 增加 slug、字段定义（secretFields / configFields）
 * 2. 在 INTEGRATION_ENV_FALLBACK 配置 env 兜底变量名（可选，便于 CI / 迁移）
 * 3. 在 integration.testers.ts 增加 testConnection 实现（可选）
 * 4. 在业务代码中通过 IntegrationsService.resolveSecret / resolveConfig / isActive 读取
 * 5. 若 C 端需要公开配置，在 configFields 标记 public: true
 * 6. 填写 docUrl、setupGuide、字段 helpUrl，便于后台展示配置教程
 *
 * 无需改数据库表结构 — integrations 表按 slug 自动 upsert。
 */
import type { IntegrationDef } from '@tzj/types';

/** 集成 env 兜底映射（DB 未配置时使用，便于迁移与 CI 注入） */
export const INTEGRATION_ENV_FALLBACK: Record<
  string,
  { secrets?: Record<string, string>; config?: Record<string, string> }
> = {
  amap: { secrets: { webKey: 'AMAP_WEB_KEY' } },
  'aliyun-captcha': {
    secrets: {
      accessKeyId: 'ALIYUN_CAPTCHA_ACCESS_KEY_ID',
      accessKeySecret: 'ALIYUN_CAPTCHA_ACCESS_KEY_SECRET',
    },
    config: {
      prefix: 'NEXT_PUBLIC_ALIYUN_CAPTCHA_PREFIX',
      sceneId: 'NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID',
      region: 'ALIYUN_CAPTCHA_REGION',
    },
  },
  'aliyun-directmail': {
    secrets: {
      accessKeyId: 'ALIYUN_DM_ACCESS_KEY_ID',
      accessKeySecret: 'ALIYUN_DM_ACCESS_KEY_SECRET',
    },
    config: {
      accountName: 'ALIYUN_DM_ACCOUNT_NAME',
      fromAlias: 'ALIYUN_DM_FROM_ALIAS',
      region: 'ALIYUN_DM_REGION',
    },
  },
  'lingxi-llm': {
    secrets: { apiKey: 'LINGXI_LLM_API_KEY' },
    config: {
      baseURL: 'LINGXI_LLM_BASE_URL',
      model: 'LINGXI_LLM_MODEL',
    },
  },
};

/** 第三方集成注册表（slug 与字段定义的唯一来源） */
export const INTEGRATION_REGISTRY: IntegrationDef[] = [
  {
    slug: 'amap',
    label: '高德地图',
    description:
      '访客分析「GPS 定位」模式下，将浏览器坐标解析为省/市/国家，用于后台「访客地区」图表。国内访客建议配置；未配置时仍可依赖 BigDataCloud 免费兜底。',
    docUrl: 'https://lbs.amap.com/api/webservice/guide/create-project/get-key',
    setupGuide: [
      {
        title: '1. 注册并登录高德开放平台',
        content:
          '访问 [高德开放平台](https://lbs.amap.com/)，使用支付宝或淘宝账号注册并完成开发者认证（个人/企业均可）。',
      },
      {
        title: '2. 创建应用并添加 Key',
        content:
          '进入 [应用管理 → 我的应用](https://console.amap.com/dev/key/app)，点击「创建新应用」，填写应用名称（如「TZJ 官网后台」）。在应用下点击「添加 Key」，**服务平台选择「Web 服务」**（不是 JS API 或 Android/iOS）。',
      },
      {
        title: '3. 复制 Web 服务 Key',
        content:
          '创建成功后，在 Key 列表中复制该 Key，粘贴到下方「Web 服务 Key」字段。此 Key 仅用于服务端逆地理编码，不会暴露给官网访客浏览器。',
      },
      {
        title: '4. 启用并测试',
        content:
          '打开右上角「启用」开关，保存后点击「测试连接」。测试会使用郑州附近坐标发起一次逆地理请求，成功即表示 Key 有效。',
      },
      {
        title: '关于 BigDataCloud 自动兜底（无需配置）',
        content:
          'GPS 模式下服务端解析顺序为：**高德逆地理（优先）→ BigDataCloud 免费 API（兜底）**。当高德 Key 未配置、配额用尽或请求超时时，系统会自动调用 [BigDataCloud Reverse Geocoding](https://www.bigdatacloud.com/free-api/free-reverse-geocode-client) 解析坐标，**无需申请 Key**，适合海外访客或开发环境。兜底精度低于高德，但可保证地区图表有数据。',
      },
    ],
    secretFields: [
      {
        key: 'webKey',
        label: 'Web 服务 Key',
        description:
          '高德控制台为该应用生成的 Web 服务类型 Key。用于服务端调用逆地理 API（/v3/geocode/regeo），将 GPS 坐标转为省市区。',
        helpUrl: 'https://lbs.amap.com/api/webservice/guide/create-project/get-key',
        required: true,
      },
    ],
    configFields: [],
  },
  {
    slug: 'aliyun-captcha',
    label: '阿里云验证码',
    description:
      '官网「联系我们」表单人机验证。启用后，访客提交前需完成阿里云验证码 2.0 校验；服务端调用 VerifyIntelligentCaptcha 二次验签，防止机器人刷表单。',
    docUrl: 'https://help.aliyun.com/zh/captcha/captcha2-0/user-guide/quick-start',
    setupGuide: [
      {
        title: '1. 开通验证码 2.0',
        content:
          '登录 [阿里云验证码 2.0 控制台](https://yundun.console.aliyun.com/?p=captcha)，按引导开通服务（按量计费，有免费额度）。开通后在「概览」页可看到实例基本信息。',
      },
      {
        title: '2. 获取身份标 prefix',
        content:
          '在控制台「概览 → 实例基本信息」中复制 **身份标（prefix）**。前端加载验证码 JS 时需要此标识，属于公开参数，会下发给官网页面（不会泄露 AccessKey）。',
      },
      {
        title: '3. 创建验证场景并获取 SceneId',
        content:
          '进入「验证场景」→「新建场景」，接入方式选 **Web/H5**，验证形态选 **滑块验证** 或 **无痕验证**（联系表单当前使用嵌入式滑块）。创建后在场景列表复制 **SceneId**，填入下方「场景 ID」。',
      },
      {
        title: '4. 创建 RAM 子账号 AccessKey',
        content:
          '为安全起见，不要使用主账号 Key。进入 [RAM 访问控制 → 用户](https://ram.console.aliyun.com/users)，创建子用户并勾选「OpenAPI 调用访问」，记录 **AccessKey ID** 与 **AccessKey Secret**。为该用户授权系统策略 [AliyunYundunAFSFullAccess](https://help.aliyun.com/zh/ram/user-guide/grant-permissions-to-a-ram-user)（验证码 2.0 服务端验签所需）。',
      },
      {
        title: '5. 填写配置并启用',
        content:
          '将 AccessKey、prefix、SceneId 填入下方对应字段；地域选 **cn**（中国内地实例）或 **sgp**（新加坡实例，需与控制台开通地域一致）。保存并启用后，点击「测试连接」确认凭证齐全。官网联系页将自动加载验证码组件。',
      },
      {
        title: '未启用时的行为',
        content:
          '若关闭此集成或未填凭证，联系表单**不强制人机验证**（与开发环境一致）。生产环境建议启用，可显著降低垃圾询盘。',
      },
    ],
    secretFields: [
      {
        key: 'accessKeyId',
        label: 'AccessKey ID',
        description:
          'RAM 子用户的 AccessKey ID，仅保存在服务端加密数据库中，用于调用 VerifyIntelligentCaptcha 接口。切勿写入前端代码或公开仓库。',
        helpUrl: 'https://ram.console.aliyun.com/users',
        required: true,
      },
      {
        key: 'accessKeySecret',
        label: 'AccessKey Secret',
        description:
          '与 AccessKey ID 配对的密钥，创建时仅显示一次，请妥善保管。泄露后应在 RAM 控制台立即禁用并轮换。',
        helpUrl: 'https://help.aliyun.com/zh/ram/user-guide/create-an-accesskey-pair',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'prefix',
        label: '身份标 prefix',
        description:
          '验证码控制台「概览 → 实例基本信息」中的身份标。前端初始化验证码 JS 时使用，属于公开标识。',
        helpUrl: 'https://yundun.console.aliyun.com/?p=captcha',
        public: true,
        required: true,
      },
      {
        key: 'sceneId',
        label: '场景 ID（SceneId）',
        description:
          '「验证场景」列表中对应 Web/H5 场景的 SceneId。决定验证码形态（滑块/无痕等）与风控策略，需与控制台场景一致。',
        helpUrl: 'https://help.aliyun.com/zh/captcha/captcha2-0/user-guide/scene-management',
        public: true,
        required: true,
      },
      {
        key: 'region',
        label: '地域',
        description:
          '与验证码实例所在地域一致：中国内地实例填 cn（接入 captcha.cn-shanghai.aliyuncs.com）；新加坡实例填 sgp。填错会导致前端验证码无法加载或验签失败。',
        helpUrl: 'https://help.aliyun.com/zh/captcha/captcha2-0/user-guide/regions-and-endpoints',
        public: true,
      },
    ],
  },
  {
    slug: 'aliyun-directmail',
    label: '阿里云邮件推送',
    description:
      '事务性邮件服务：新询盘自动通知相关负责人、向访客发送确认邮件。需在阿里云邮件推送控制台完成发信域名验证并创建发信地址。',
    docUrl: 'https://help.aliyun.com/product/29412.html',
    setupGuide: [
      {
        title: '1. 开通邮件推送并验证发信域名',
        content:
          '登录 [阿里云邮件推送控制台](https://dm.console.aliyun.com/)，添加并验证发信域名（配置 SPF、DKIM 等 DNS 记录），等待审核通过。',
      },
      {
        title: '2. 创建发信地址',
        content:
          '在「发信地址」中新建地址（如 notify@mail.yourdomain.com），记录 **AccountName**（完整发信邮箱），填入下方「发信地址」。',
      },
      {
        title: '3. 配置 AccessKey',
        content:
          '使用 RAM 子账号 AccessKey（建议仅授予 AliyunDirectMailFullAccess 或最小 SendMail 权限），填入 AccessKey ID 与 Secret。',
      },
      {
        title: '4. 启用并测试',
        content:
          '保存后点击「测试连接」。然后在 **站点设置 → 邮件通知** 中配置询盘通知收件人并提交一条测试询盘验证。',
      },
    ],
    secretFields: [
      {
        key: 'accessKeyId',
        label: 'AccessKey ID',
        required: true,
        helpUrl: 'https://ram.console.aliyun.com/manage/ak',
      },
      {
        key: 'accessKeySecret',
        label: 'AccessKey Secret',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'accountName',
        label: '发信地址（AccountName）',
        description: '控制台「发信地址」中的完整邮箱，须已通过域名验证。',
        required: true,
        helpUrl: 'https://help.aliyun.com/zh/direct-mail/user-guide/create-a-sender-address',
      },
      {
        key: 'fromAlias',
        label: '发件人昵称',
        description: '收件人看到的发件人名称，如「拓之迹官网通知」。',
      },
      {
        key: 'region',
        label: '地域',
        description: '默认 cn-hangzhou。中国内地实例一般填 cn-hangzhou 即可。',
      },
    ],
  },
  {
    slug: 'lingxi-llm',
    label: '灵犀 AI（LLM）',
    description:
      '后台「灵犀」智能投放报告的大模型服务。默认接入 DeepSeek 官方 API；也可切换为硅基流动等任意 OpenAI 兼容平台（改 Base URL 与模型名即可，零代码切换）。',
    docUrl: 'https://platform.deepseek.com/docs',
    setupGuide: [
      {
        title: '1. 注册 DeepSeek 开放平台',
        content:
          '访问 [DeepSeek 开放平台](https://platform.deepseek.com/)，注册并充值（按量计费，新用户通常有赠送额度）。',
      },
      {
        title: '2. 创建 API Key',
        content:
          '进入 [API Keys](https://platform.deepseek.com/api_keys) 页面创建密钥，创建时仅显示一次，复制后填入下方「API Key」字段。**切勿将 Key 发给他人或粘贴到聊天工具**，泄露后请立即在平台删除重建。',
      },
      {
        title: '3. 启用并测试',
        content:
          '保存后点击「测试连接」，系统会请求模型列表接口验证 Key 有效性。通过后，拥有「使用灵犀 AI」权限的角色即可在后台使用灵犀。',
      },
      {
        title: '切换到硅基流动（可选）',
        content:
          'DeepSeek 官方拥堵或需要其它模型时，可将 Base URL 改为 https://api.siliconflow.cn/v1、模型名改为该平台提供的 DeepSeek 型号（以平台列表为准）并更换对应 API Key，无需改代码。',
      },
    ],
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        description:
          '大模型平台的 API 密钥，仅保存在服务端加密数据库中，用于服务端调用 Chat Completions 接口。',
        helpUrl: 'https://platform.deepseek.com/api_keys',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'baseURL',
        label: 'Base URL',
        description:
          'OpenAI 兼容接口地址。DeepSeek 官方：https://api.deepseek.com；硅基流动：https://api.siliconflow.cn/v1。留空时默认 DeepSeek 官方。',
      },
      {
        key: 'model',
        label: '模型名',
        description:
          '对话模型标识。DeepSeek 官方推荐 deepseek-v4-flash（默认），更强可选 deepseek-v4-pro；旧名 deepseek-chat / deepseek-reasoner 已废弃。留空时默认 deepseek-v4-flash。',
      },
    ],
  },
];

export const INTEGRATION_SLUGS = new Set(INTEGRATION_REGISTRY.map((item) => item.slug));

export function getIntegrationDef(slug: string): IntegrationDef | undefined {
  return INTEGRATION_REGISTRY.find((item) => item.slug === slug);
}

/** 基础设施级密钥：仅 env/KMS，不可通过后台写入 DB */
export const INFRASTRUCTURE_ENV_KEYS = [
  {
    key: 'SECRETS_ENCRYPTION_KEY',
    label: '凭证加密主密钥',
    description:
      'AES-256-GCM 加密 DB 中第三方 AccessKey 等敏感字段。至少 32 字符，部署时在服务器环境变量或密钥管理服务中注入；缺失则无法在后台保存集成凭证。',
  },
  {
    key: 'JWT_SECRET',
    label: 'JWT 签名密钥',
    description:
      '后台管理员登录会话令牌的 HMAC 签名密钥。应使用足够长的随机字符串，仅部署环境可见。',
  },
  {
    key: 'DATABASE_URL',
    label: '数据库连接',
    description:
      'PostgreSQL 连接串（含用户名、密码、主机、库名）。所有业务数据与加密凭证均存储于此。',
  },
  {
    key: 'S3_ACCESS_KEY_SECRET',
    label: '对象存储 Secret',
    description:
      'MinIO / 阿里云 OSS / AWS S3 的 Secret Access Key，与 Access Key ID 配对，用于媒体文件上传与访问。',
  },
] as const;
