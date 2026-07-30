import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { IntegrationsService } from '../../integrations/integrations.service';

export const LINGXI_LLM_SLUG = 'lingxi-llm';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

export interface ResolvedLlm {
  client: OpenAI;
  model: string;
}

/**
 * openai SDK 封装：凭证解析（集成中心 → env 兜底）、超时、重试。
 * 每次调用即时解析（后台改凭证立即生效，无需重启）；
 * 未配置 Key 时抛 503 明确错误，供控制器在建立 SSE 前拦截。
 */
@Injectable()
export class LlmClient {
  constructor(private readonly integrations: IntegrationsService) {}

  async isConfigured(): Promise<boolean> {
    const apiKey = await this.integrations.resolveSecret(LINGXI_LLM_SLUG, 'apiKey');
    return Boolean(apiKey);
  }

  async resolve(): Promise<ResolvedLlm> {
    const apiKey = await this.integrations.resolveSecret(LINGXI_LLM_SLUG, 'apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        '灵犀大模型服务未配置：请在「集成与凭证」中启用「灵犀 AI（LLM）」并填写 API Key',
      );
    }
    const baseURL =
      (await this.integrations.resolveConfig(LINGXI_LLM_SLUG, 'baseURL')) || DEFAULT_BASE_URL;
    const model =
      (await this.integrations.resolveConfig(LINGXI_LLM_SLUG, 'model')) || DEFAULT_MODEL;
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 60_000, // 单请求超时（DeepSeek 长报告首 token 可能 >10s，放宽到 60s）
      maxRetries: 1, // SDK 自带指数退避；流式请求失败由上层发 error 帧
    });
    return { client, model };
  }
}
