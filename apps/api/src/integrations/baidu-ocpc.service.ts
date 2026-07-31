import { Injectable, Logger } from '@nestjs/common';
import type { Contact } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';

const SLUG = 'baidu-ocpc';
const UPLOAD_ENDPOINT = 'https://ocpc.baidu.com/ocpcapi/api/uploadConvertData';
/** 网络/服务端异常（status=4）重试次数，与百度官方 Demo 一致 */
const MAX_RETRY = 3;
/** logidUrl 长度上限（百度接口限制 1024 字符） */
const MAX_LOGID_URL_LEN = 1024;

/**
 * 百度 OCPC 转化回传（P1-2/P1-1）：询盘表单提交后，按访客首触 bd_vid 反查，
 * 命中则服务端调用百度 uploadConvertData 接口回传转化，供 OCPC 智能出价模型优化。
 *
 * 设计要点：
 * - fire-and-forget：任何异常都被吞掉并记日志，绝不阻断询盘提交主流程；
 * - 凭证走「后台集成」注册表（DB 加密优先、env 兜底），未启用/未配置时静默跳过；
 * - 仅带 bd_vid 的百度付费点击询盘会回传，自然/其它渠道自动跳过（无 bd_vid）。
 */
@Injectable()
export class BaiduOcpcService {
  private readonly logger = new Logger(BaiduOcpcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  /** 询盘转化回传入口（调用方无需 await，失败不影响询盘）。 */
  async reportInquiryConversion(contact: Pick<Contact, 'id' | 'visitorId'>): Promise<void> {
    try {
      if (!(await this.integrations.isActive(SLUG))) return;

      const visitorId = contact.visitorId?.trim();
      if (!visitorId) return;

      // 首触 bd_vid：该访客最早一条带 bd_vid 的浏览记录（与埋点「会话首触归因」口径一致）
      const firstTouch = await this.prisma.pageView.findFirst({
        where: { visitorId, bdVid: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { bdVid: true, path: true },
      });
      const bdVid = firstTouch?.bdVid?.trim();
      if (!bdVid) return; // 自然/其它渠道询盘，无需回传

      const token = await this.integrations.resolveSecret(SLUG, 'token');
      const convertTypeRaw = await this.integrations.resolveConfig(SLUG, 'convertType');
      const siteUrl = await this.integrations.resolveConfig(SLUG, 'siteUrl');
      const newType = Number(convertTypeRaw);
      if (!token || !siteUrl || !convertTypeRaw || Number.isNaN(newType)) return;

      const logidUrl = this.buildLogidUrl(siteUrl, firstTouch?.path ?? null, bdVid);
      const ok = await this.uploadConversion(token, logidUrl, newType);
      if (ok) {
        this.logger.log(`OCPC 转化回传成功 contact=${contact.id}`);
      } else {
        this.logger.warn(`OCPC 转化回传未成功 contact=${contact.id}`);
      }
    } catch (error) {
      // 回传失败绝不阻断询盘：仅记录，等待后续人工或下一次触发
      this.logger.warn(`OCPC 转化回传异常 contact=${contact.id}: ${(error as Error).message}`);
    }
  }

  /** 拼接 logidUrl：落地页域名 + 首触路径 + bd_vid（百度按 bd_vid 匹配点击）。 */
  private buildLogidUrl(siteUrl: string, path: string | null, bdVid: string): string {
    const base = siteUrl.replace(/\/$/, '');
    const cleanPath = path?.startsWith('/') ? path.split('?')[0] : '/';
    const url = `${base}${cleanPath}`;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}bd_vid=${encodeURIComponent(bdVid)}`.slice(0, MAX_LOGID_URL_LEN);
  }

  /** 调百度 uploadConvertData；status=4（服务端异常）时重试，最多 MAX_RETRY 次。 */
  private async uploadConversion(
    token: string,
    logidUrl: string,
    newType: number,
  ): Promise<boolean> {
    const body = JSON.stringify({
      token,
      conversionTypes: [{ logidUrl, newType }],
    });
    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        const res = await fetch(UPLOAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { header?: { status?: number } };
        const status = data.header?.status;
        if (status === 4) continue; // 服务端异常，重试
        return status === 0; // 0=成功；1(部分)/2(全失败)/3(token 失败) 均视为失败且不重试
      } catch {
        // 网络异常或超时，进入下一次重试
      }
    }
    return false;
  }
}
