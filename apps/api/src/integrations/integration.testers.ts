import type { IntegrationTestResult } from '@tzj/types';
import { IntegrationsService } from './integrations.service';

export type IntegrationTester = (service: IntegrationsService) => Promise<IntegrationTestResult>;

/** 各集成的「测试连接」实现（新增集成时在此注册） */
export const INTEGRATION_TESTERS: Record<string, IntegrationTester> = {
  amap: async (service) => {
    const webKey = await service.resolveSecret('amap', 'webKey');
    if (!webKey) {
      return { ok: false, message: '未配置 Web 服务 Key' };
    }
    try {
      const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
      url.searchParams.set('key', webKey);
      url.searchParams.set('location', '113.6253,34.7466');
      url.searchParams.set('coordsys', 'gps');
      url.searchParams.set('extensions', 'base');
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = (await res.json()) as { status?: string; info?: string };
      if (data.status !== '1') {
        return { ok: false, message: data.info ?? '高德逆地理 API 返回错误' };
      }

      // 顺带验证 IP 定位可用（同一 Key，配额共享）
      const ipUrl = new URL('https://restapi.amap.com/v3/ip');
      ipUrl.searchParams.set('key', webKey);
      ipUrl.searchParams.set('ip', '114.247.50.2');
      const ipRes = await fetch(ipUrl, { signal: AbortSignal.timeout(5000) });
      const ipData = (await ipRes.json()) as { status?: string; info?: string; province?: string };
      if (ipData.status !== '1') {
        return { ok: false, message: `逆地理可用，但 IP 定位失败：${ipData.info ?? '未知错误'}` };
      }
      return {
        ok: true,
        message: `连接成功，逆地理 + IP 定位可用（示例 IP 归属：${ipData.province || '未知'}）`,
      };
    } catch {
      return { ok: false, message: '无法连接高德 API，请检查网络与 Key' };
    }
  },

  'aliyun-captcha': async (service) => {
    const accessKeyId = await service.resolveSecret('aliyun-captcha', 'accessKeyId');
    const accessKeySecret = await service.resolveSecret('aliyun-captcha', 'accessKeySecret');
    const prefix = await service.resolveConfig('aliyun-captcha', 'prefix');
    const sceneId = await service.resolveConfig('aliyun-captcha', 'sceneId');
    if (!accessKeyId || !accessKeySecret) {
      return { ok: false, message: '请配置 AccessKey ID 与 Secret' };
    }
    if (!prefix || !sceneId) {
      return { ok: false, message: '请配置身份标 prefix 与场景 ID' };
    }
    return {
      ok: true,
      message: '凭证已配置（提交联系表单时将调用 VerifyIntelligentCaptcha 校验）',
    };
  },

  'aliyun-exmail': async (service) => {
    const accountName = await service.resolveConfig('aliyun-exmail', 'accountName');
    const smtpPassword = await service.resolveSecret('aliyun-exmail', 'smtpPassword');
    if (!accountName) {
      return { ok: false, message: '请配置发件账号' };
    }
    if (!smtpPassword) {
      return { ok: false, message: '请配置三方客户端安全密码' };
    }
    // 真实 SMTP 握手 + 认证探活（smtp.qiye.aliyun.com:465），失败返回可读原因
    // 动态 import 避免与 integrations.service 形成循环依赖（integrations → testers → exmail → integrations）
    const { ExmailSmtpService } = await import('./exmail-smtp.service');
    const smtp = new ExmailSmtpService(service);
    return smtp.verify();
  },

  'lingxi-llm': async (service) => {
    const apiKey = await service.resolveSecret('lingxi-llm', 'apiKey');
    if (!apiKey) {
      return { ok: false, message: '未配置 API Key' };
    }
    const baseURL =
      (await service.resolveConfig('lingxi-llm', 'baseURL')) || 'https://api.deepseek.com';
    try {
      // OpenAI 兼容平台通用探活：GET /models 验证 Key 与端点可达
      const res = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { ok: true, message: '连接成功，API Key 有效' };
      }
      if (res.status === 401) {
        return { ok: false, message: 'API Key 无效或已删除，请到平台重新创建' };
      }
      return { ok: false, message: `平台返回 HTTP ${res.status}，请检查 Base URL 与账户状态` };
    } catch {
      return { ok: false, message: '无法连接大模型平台，请检查网络与 Base URL' };
    }
  },

  'baidu-ocpc': async (service) => {
    const token = await service.resolveSecret('baidu-ocpc', 'token');
    const convertType = await service.resolveConfig('baidu-ocpc', 'convertType');
    const siteUrl = await service.resolveConfig('baidu-ocpc', 'siteUrl');
    if (!token) {
      return { ok: false, message: '未配置回传 Token' };
    }
    if (!convertType || Number.isNaN(Number(convertType))) {
      return { ok: false, message: '请配置有效的转化类型编码（newType，整数）' };
    }
    if (!siteUrl) {
      return { ok: false, message: '请配置落地页域名' };
    }
    // 哨兵探活：用假 bd_vid 回传一条，仅据 header.status 判定 Token 是否有效——
    // status=3 为 Token 校验失败；其余（数据因假 bd_vid 被拒）说明 Token 有效，不产生真实转化。
    try {
      const res = await fetch('https://ocpc.baidu.com/ocpcapi/api/uploadConvertData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          token,
          conversionTypes: [
            {
              logidUrl: `${siteUrl.replace(/\/$/, '')}/?bd_vid=tzj-connection-test`,
              newType: Number(convertType),
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { ok: false, message: `百度返回 HTTP ${res.status}，请稍后重试` };
      }
      const data = (await res.json()) as { header?: { status?: number; desc?: string } };
      const status = data.header?.status;
      if (status === 3) {
        return { ok: false, message: 'Token 校验失败，请到百度营销后台核对回传 Token' };
      }
      return {
        ok: true,
        message: 'Token 有效（哨兵数据已被百度按预期拒绝，不产生真实转化）',
      };
    } catch {
      return { ok: false, message: '无法连接百度 OCPC 回传接口，请检查网络' };
    }
  },
};
