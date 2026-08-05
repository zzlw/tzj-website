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

/** 高德 IP 定位开关（后台「IP 定位接入方式」配置项的可选值） */
export const AMAP_IP_LOCATION_MODES = ['off', 'on'] as const;
export type AmapIpLocationMode = (typeof AMAP_IP_LOCATION_MODES)[number];

/** 集成 env 兜底映射（DB 未配置时使用，便于迁移与 CI 注入） */
export const INTEGRATION_ENV_FALLBACK: Record<
  string,
  { secrets?: Record<string, string>; config?: Record<string, string> }
> = {
  amap: {
    secrets: { webKey: 'AMAP_WEB_KEY' },
    config: { ipLocationMode: 'AMAP_IP_LOCATION_MODE' },
  },
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
  'aliyun-exmail': {
    secrets: {
      smtpPassword: 'ALIYUN_EXMAIL_SMTP_PASSWORD',
    },
    config: {
      accountName: 'ALIYUN_EXMAIL_ACCOUNT_NAME',
      fromAlias: 'ALIYUN_EXMAIL_FROM_ALIAS',
    },
  },
  'lingxi-llm': {
    secrets: { apiKey: 'LINGXI_LLM_API_KEY' },
    config: {
      baseURL: 'LINGXI_LLM_BASE_URL',
      model: 'LINGXI_LLM_MODEL',
    },
  },
  'baidu-ocpc': {
    secrets: { token: 'BAIDU_OCPC_TOKEN' },
    config: {
      convertType: 'BAIDU_OCPC_CONVERT_TYPE',
      siteUrl: 'BAIDU_OCPC_SITE_URL',
    },
  },
};

/** 第三方集成注册表（slug 与字段定义的唯一来源） */
export const INTEGRATION_REGISTRY: IntegrationDef[] = [
  {
    slug: 'amap',
    label: '高德地图',
    description:
      '访客地区定位增强：IP 模式默认走内置 ip2region 离线库（免费、无需授权），可配置高德补充；GPS 模式将浏览器坐标解析为省/市/国家。未配置或解析失败时自动回退 BigDataCloud（免费、无需 Key）。',
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
          '打开右上角「启用」开关，保存后点击「测试连接」。测试会分别发起一次逆地理（郑州坐标）与一次 IP 定位（示例 IP）请求，均成功即表示 Key 有效。',
      },
      {
        title: '5. IP 定位接入方式（可选）',
        content:
          '在下方「IP 定位接入方式」选择：**on**（启用，推荐）或 **off**（关闭）。IP 定位默认由内置 ip2region 离线库处理（国内省/市 + 运营商，免费无需授权）；开启高德后，离线库未命中的 IP 会再尝试高德 IP 定位（仅国内 IPv4），两者都失败时回退 BigDataCloud。与逆地理共用 Web 服务月配额，访客地区缓存 7 天，日常量级远低于免费配额。',
      },
      {
        title: 'BigDataCloud 自动兜底（无需配置）',
        content:
          '项目已移除 geoip-lite、纯真库与 ip-api 等旧方案；IP 模式默认 ip2region 离线库（免费），GPS 模式高德逆地理，未命中时自动使用 [BigDataCloud](https://www.bigdatacloud.com/)（免费、无需 Key）：GPS 坐标逆地理与海外 IP 归属地均可解析，保证地区图表有数据。',
      },
    ],
    secretFields: [
      {
        key: 'webKey',
        label: 'Web 服务 Key',
        description:
          '高德控制台为该应用生成的 Web 服务类型 Key。服务端调用逆地理 API（/v3/geocode/regeo）与 IP 定位 API（/v3/ip）时使用，将 GPS 坐标 / 访客 IP 转为省市区。',
        helpUrl: 'https://lbs.amap.com/api/webservice/guide/create-project/get-key',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'ipLocationMode',
        label: 'IP 定位接入方式',
        description:
          '是否在 ip2region 离线库未命中时调用高德 IP 定位（与逆地理共用配额）。on=启用（默认）；off=关闭高德，仅用离线库 + BigDataCloud。海外 IP 由 BigDataCloud 解析。',
      },
    ],
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
    slug: 'aliyun-exmail',
    label: '阿里企业邮箱 SMTP',
    description:
      '事务性邮件服务：新询盘自动通知相关负责人、向访客发送确认邮件。使用阿里企业邮箱（免费版）SMTP 发信，访客可直接回复发件邮箱。',
    docUrl: 'https://qiye.aliyun.com/',
    setupGuide: [
      {
        title: '1. 开通阿里企业邮箱（免费版）并绑定域名',
        content:
          '访问 [阿里企业邮箱免费版](https://exmail.aliyun.com/free)，绑定 tzjii.com，完成域名验证 TXT 与 DKIM 解析（SPF 需先合并企业邮箱 include，勿一键覆盖）。',
      },
      {
        title: '2. 创建发件账号并设置密码',
        content:
          '登录域管后台创建 service@tzjii.com 等账号，每个账号需设置登录密码（9-64 位，含大小写/数字/特殊字符中任三种）。',
      },
      {
        title: '3. 允许三方客户端访问',
        content:
          '域管后台「安全策略 → 三方客户端登录管理」中关闭默认的「禁止使用三方客户端」黑名单策略，否则 SMTP 认证会返回 526。',
      },
      {
        title: '4. 生成三方客户端安全密码',
        content:
          '用发件账号登录个人邮箱 webmail，进入「设置 → 账户与安全 → 账户安全 → 三方客户端安全管理」，新增安全密码（如用途填 TZJ SMTP），将生成的密码填入下方「三方客户端安全密码」。',
      },
      {
        title: '5. 启用并测试',
        content:
          '保存后点击「测试连接」——系统会用真实 SMTP 握手 + 认证探活（smtp.qiye.aliyun.com:465）。通过后可在 **站点设置 → 邮件通知** 中配置询盘通知收件人并提交一条测试询盘验证。',
      },
    ],
    secretFields: [
      {
        key: 'smtpPassword',
        label: '三方客户端安全密码',
        description:
          '发件账号在个人邮箱「三方客户端安全管理」中生成的安全密码，独立于登录密码、可单独吊销。仅保存在服务端加密数据库中。',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'accountName',
        label: '发件账号',
        description: 'SMTP 发件邮箱（如 service@tzjii.com），须已完成企业邮箱开通。',
        required: true,
      },
      {
        key: 'fromAlias',
        label: '发件人昵称',
        description: '收件人看到的发件人名称，如「拓之迹官网通知」。',
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
  {
    slug: 'baidu-ocpc',
    label: '百度 OCPC 转化回传',
    description:
      '将官网询盘表单提交作为转化事件，服务端回传给百度搜索推广 OCPC。启用后，询盘落库时按访客首触 bd_vid 反查并调用百度回传 API，使 OCPC 智能出价模型拿到真实转化数据（降本关键）。仅带 bd_vid 的百度付费点击询盘会回传，自然/其它渠道自动跳过。',
    docUrl: 'https://ocpx.baidu.com/developer/ocpc-doc/api/api-doc/api-interface/',
    setupGuide: [
      {
        title: '1. 新建「API 回传」转化追踪',
        content:
          '登录 [百度营销推广后台](https://www2.baidu.com/)，进入「转化跟踪 → 新建转化追踪」，数据收集方式选 **API 回传**，转化类型选与「表单提交/留言」对应的类型。保存后即可获取该账户唯一的回传 **Token**。',
      },
      {
        title: '2. 记录转化类型编码（newType）',
        content:
          '在转化追踪列表中查看所选转化类型对应的 **类型编码（newType）**，如「表单提交」等（以后台披露的编码为准）。填入下方「转化类型编码」字段。',
      },
      {
        title: '3. 填写 Token 与落地页域名',
        content:
          '将第 1 步的 Token 填入「回传 Token」；「落地页域名」填官网对外访问地址（如 https://www.tzjii.com），用于拼接回传所需的 logidUrl。',
      },
      {
        title: '4. 启用并测试连接',
        content:
          '打开「启用」开关并保存，点击「测试连接」——系统会用一条哨兵数据探活，只校验 Token 是否有效（不会产生真实转化）。通过后，此后每条带 bd_vid 的付费询盘都会自动回传。',
      },
      {
        title: '前置依赖',
        content:
          '需先完成旧站 301（老创意落地页带 bd_vid）与埋点 bd_vid 采集（已上线）。回传链路为「询盘提交 → visitorId → page_views 首触 bd_vid → 百度 OCPC 回传 API」，全程服务端进行，无需改前端。',
      },
    ],
    secretFields: [
      {
        key: 'token',
        label: '回传 Token',
        description:
          '百度营销后台「新建转化追踪 → API 回传」生成的账户唯一 Token，仅保存在服务端加密数据库中，用于调用 uploadConvertData 接口。搜索推广与信息流可共用同一 Token。',
        helpUrl: 'https://ocpx.baidu.com/developer/ocpc-doc/api/api-fc/',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'convertType',
        label: '转化类型编码（newType）',
        description:
          '回传时标记的转化类型整数编码，以百度后台新建转化追踪披露的编码为准（询盘表单提交对应的类型）。',
        helpUrl: 'https://ocpx.baidu.com/developer/ocpc-doc/api/api-doc/api-interface/',
        required: true,
      },
      {
        key: 'siteUrl',
        label: '落地页域名',
        description:
          '官网对外访问地址（如 https://www.tzjii.com），用于拼接回传 logidUrl（形如 域名/首触路径?bd_vid=xxx）。百度按 bd_vid 匹配点击，域名需与实际投放落地页一致。',
        required: true,
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
