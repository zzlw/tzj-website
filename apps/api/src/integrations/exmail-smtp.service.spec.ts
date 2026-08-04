import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { ExmailSmtpService } from './exmail-smtp.service';
import type { IntegrationsService } from './integrations.service';

/**
 * ExmailSmtpService 回归（docs/dm-to-exmail-migration-plan.md §4.2.1/§4.2.7）：
 * - 固定 host=smtp.qiye.aliyun.com / port=465 / secure=true / 强制超时；
 * - from 由 accountName + fromAlias 拼装；
 * - 错误日志绝不包含 smtpPassword（安全断言）；
 * - isAvailable 跟随集成启用状态（slug=aliyun-exmail）；
 * - verify() 探活成功/认证失败/网络不可达返回可读原因。
 */

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

const mockCreateTransport = nodemailer.createTransport as unknown as jest.Mock;

function mockIntegrations() {
  return {
    isActive: jest.fn(),
    resolveSecret: jest.fn(),
    resolveConfig: jest.fn(),
  } as unknown as IntegrationsService;
}

function mockTransport() {
  return {
    verify: jest.fn(),
    sendMail: jest.fn(),
    close: jest.fn(),
  };
}

function configuredService(integrations = mockIntegrations()) {
  return new ExmailSmtpService(integrations);
}

describe('ExmailSmtpService', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCreateTransport.mockReset();
    mockCreateTransport.mockReturnValue(mockTransport());
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('isAvailable 跟随集成启用状态（slug=aliyun-exmail）', async () => {
    const integrations = mockIntegrations();
    integrations.isActive = jest.fn().mockResolvedValue(true);
    const svc = configuredService(integrations);

    await expect(svc.isAvailable()).resolves.toBe(true);
    integrations.isActive = jest.fn().mockResolvedValue(false);
    await expect(svc.isAvailable()).resolves.toBe(false);
    expect(integrations.isActive).toHaveBeenCalledWith('aliyun-exmail');
  });

  it('transport 配置：固定 host/port/secure 与强制超时', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '拓之迹官网',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);

    await svc.sendMail({ to: 'a@b.com', subject: 's', html: '<p>h</p>' });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.qiye.aliyun.com',
      port: 465,
      secure: true,
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
      auth: { user: 'service@tzjii.com', pass: 'secret-pass' },
    });
  });

  it('from 由 fromAlias + accountName 拼装', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '拓之迹官网',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);
    const transport = mockTransport();
    mockCreateTransport.mockReturnValue(transport);

    await svc.sendMail({ to: 'a@b.com', subject: 's', html: '<p>h</p>' });

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"拓之迹官网" <service@tzjii.com>' }),
    );
    expect(transport.close).toHaveBeenCalled();
  });

  it('发送失败时错误日志不包含 smtpPassword', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '拓之迹官网',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);
    const transport = mockTransport();
    transport.sendMail.mockRejectedValue(new Error('535 Authentication failure'));
    mockCreateTransport.mockReturnValue(transport);

    await expect(svc.sendMail({ to: 'a@b.com', subject: 's', html: '<p>h</p>' })).rejects.toThrow(
      '535',
    );

    // 日志只含 host/账号/错误码，绝不打印 smtpPassword
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('secret-pass');
  });

  it('凭证缺失时直接抛错且不创建 transport', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest.fn().mockResolvedValue(undefined);
    integrations.resolveSecret = jest.fn().mockResolvedValue(undefined);
    const svc = configuredService(integrations);

    await expect(svc.sendMail({ to: 'a@b.com', subject: 's', html: '<p>h</p>' })).rejects.toThrow(
      '阿里企业邮箱 SMTP 未完整配置',
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('verify() 认证通过返回成功', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);
    const transport = mockTransport();
    transport.verify.mockResolvedValue(true);
    mockCreateTransport.mockReturnValue(transport);

    const result = await svc.verify();
    expect(result.ok).toBe(true);
    expect(result.message).toContain('smtp.qiye.aliyun.com:465');
  });

  it('verify() 认证失败返回可读原因', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);
    const transport = mockTransport();
    transport.verify.mockRejectedValue(new Error('535 5.7.8 Authentication credentials invalid'));
    mockCreateTransport.mockReturnValue(transport);

    const result = await svc.verify();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('认证失败');
  });

  it('verify() 网络不可达返回可读原因', async () => {
    const integrations = mockIntegrations();
    integrations.resolveConfig = jest
      .fn()
      .mockImplementation(async (_slug: string, key: string) =>
        key === 'accountName' ? 'service@tzjii.com' : '',
      );
    integrations.resolveSecret = jest.fn().mockResolvedValue('secret-pass');
    const svc = configuredService(integrations);
    const transport = mockTransport();
    transport.verify.mockRejectedValue(new Error('connect ECONNREFUSED 1.2.3.4:465'));
    mockCreateTransport.mockReturnValue(transport);

    const result = await svc.verify();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('无法连接');
  });
});
