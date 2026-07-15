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
      if (data.status === '1') {
        return { ok: true, message: '连接成功，逆地理编码可用' };
      }
      return { ok: false, message: data.info ?? '高德 API 返回错误' };
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

  'aliyun-directmail': async (service) => {
    const accessKeyId = await service.resolveSecret('aliyun-directmail', 'accessKeyId');
    const accessKeySecret = await service.resolveSecret('aliyun-directmail', 'accessKeySecret');
    const accountName = await service.resolveConfig('aliyun-directmail', 'accountName');
    if (!accessKeyId || !accessKeySecret) {
      return { ok: false, message: '请配置 AccessKey ID 与 Secret' };
    }
    if (!accountName) {
      return { ok: false, message: '请配置发信地址 AccountName' };
    }
    return {
      ok: true,
      message: `凭证已配置，发信地址 ${accountName}（保存后可在站点设置配置通知收件人）`,
    };
  },
};
