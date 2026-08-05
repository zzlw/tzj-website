import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';

const prisma = {
  integration: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
} as unknown as PrismaService;

const config = { get: jest.fn() } as unknown as ConfigService;

describe('IntegrationsService（高德 IP 定位接入方式校验）', () => {
  let service: IntegrationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntegrationsService(prisma, config);
  });

  it('amap 配置 ipLocationMode 为非法值时保存报错', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);

    await expect(
      service.update('amap', { enabled: true, config: { ipLocationMode: 'prefered' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.integration.upsert).not.toHaveBeenCalled();
  });

  it('amap 配置 ipLocationMode 合法时归一化为小写并保存', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);
    prisma.integration.upsert.mockResolvedValue({});
    // update 末尾的 getAdminOverview 依赖 findMany，仅验证可正常走到 upsert
    prisma.integration.findMany = jest.fn().mockResolvedValue([]);

    await service.update('amap', { enabled: true, config: { ipLocationMode: '  ON  ' } });

    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          config: expect.objectContaining({ ipLocationMode: 'on' }),
        }),
      }),
    );
  });
});
