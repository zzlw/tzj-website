import type { IntegrationsPublicConfig } from "@tzj/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const CACHE_KEY = "_tzj_integrations_public";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface AliyunCaptchaPublicConfig {
  prefix: string;
  sceneId: string;
  region: string;
}

/** 拉取 C 端公开集成配置（带 session 缓存；env 兜底） */
export async function getIntegrationsPublicConfig(): Promise<IntegrationsPublicConfig> {
  if (typeof window === "undefined") return envCaptchaFallback();

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as {
        data: IntegrationsPublicConfig;
        exp: number;
      };
      if (parsed.exp > Date.now()) return mergeEnvFallback(parsed.data);
    }

    const res = await fetch(`${API_BASE}/integrations/public`, {
      cache: "no-store",
    });
    if (!res.ok) return envCaptchaFallback();

    const json = (await res.json()) as {
      data?: IntegrationsPublicConfig;
    };
    const data = json.data ?? {};
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, exp: Date.now() + CACHE_TTL_MS }),
    );
    return mergeEnvFallback(data);
  } catch {
    return envCaptchaFallback();
  }
}

function envCaptchaFallback(): IntegrationsPublicConfig {
  const prefix = process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_PREFIX?.trim();
  const sceneId = process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID?.trim();
  if (!prefix || !sceneId) return {};
  return {
    "aliyun-captcha": {
      prefix,
      sceneId,
      region: process.env.ALIYUN_CAPTCHA_REGION?.trim() || "cn",
    },
  };
}

function mergeEnvFallback(
  data: IntegrationsPublicConfig,
): IntegrationsPublicConfig {
  const env = envCaptchaFallback();
  if (env["aliyun-captcha"] && !data["aliyun-captcha"]) {
    return { ...data, "aliyun-captcha": env["aliyun-captcha"] };
  }
  return data;
}

export function resolveAliyunCaptchaConfig(
  config: IntegrationsPublicConfig,
): AliyunCaptchaPublicConfig | null {
  const raw = config["aliyun-captcha"];
  const prefix = raw?.prefix?.trim();
  const sceneId = raw?.sceneId?.trim();
  if (!prefix || !sceneId) return null;
  return {
    prefix,
    sceneId,
    region: raw?.region?.trim() || "cn",
  };
}
