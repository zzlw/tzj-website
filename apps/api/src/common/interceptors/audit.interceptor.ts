import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthUser } from '../../auth/roles';
import { PrismaService } from '../../prisma/prisma.service';

const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** 需要记录变更摘要的资源（敏感字段排除） */
const DETAIL_RESOURCES = new Set(['users', 'access', 'auth']);
const SENSITIVE_KEYS = new Set(['password', 'actorPassword', 'newPassword', 'currentPassword']);

/**
 * 审计拦截器：对已登录用户的写操作（POST/PUT/PATCH/DELETE）在成功后落库一条审计日志。
 * 失败或异常不写（异常已由过滤器处理），写审计本身出错不影响主流程。
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string; user?: AuthUser }>();

    const action = ACTION_BY_METHOD[req.method];
    const user = req.user;

    // 仅审计已登录用户的写操作
    if (!action || !user) {
      return next.handle();
    }

    const resource = this.resourceFromUrl(req.originalUrl || req.url);

    return next.handle().pipe(
      tap((result) => {
        const resourceId = (req.params?.id as string | undefined) ?? this.idFromResult(result);
        const detail = this.buildDetail(resource, req);
        void this.write({
          userId: user.id,
          action,
          resource,
          resourceId,
          detail,
          ip: req.ip,
          userAgent: req.headers['user-agent']?.slice(0, 512),
          traceId: req.id,
        });
      }),
    );
  }

  private idFromResult(result: unknown): string | undefined {
    if (result && typeof result === 'object' && 'id' in result) {
      const id = (result as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    }
    return undefined;
  }

  /** 对敏感资源的写操作记录变更字段摘要（排除密码等敏感字段） */
  private buildDetail(resource: string, req: Request): Record<string, unknown> | undefined {
    if (!DETAIL_RESOURCES.has(resource)) return undefined;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') return undefined;
    const changedFields = Object.keys(body).filter((k) => !SENSITIVE_KEYS.has(k));
    return changedFields.length > 0 ? { changedFields } : undefined;
  }

  private resourceFromUrl(url: string): string {
    const path = url.split('?')[0] ?? '';
    const parts = path.split('/').filter(Boolean); // ["api","v1","products",":id"]
    const idx = parts.indexOf('v1');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1]! : 'unknown';
  }

  private async write(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    detail?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    traceId?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...data,
          detail: data.detail as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`审计写入失败: ${(e as Error).message}`);
    }
  }
}
