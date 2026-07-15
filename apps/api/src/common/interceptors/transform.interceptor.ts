import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponseFormat<T> {
  success: true;
  data: T;
  pagination?: unknown;
  traceId?: string;
  timestamp: string;
}

function hasPagination(value: unknown): value is { data: unknown; pagination: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value && 'pagination' in value;
}

/**
 * 统一成功响应：{ success, data, pagination?, traceId, timestamp }
 * 若 service 返回 { data, pagination }（分页），自动上提 pagination。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseFormat<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseFormat<T>> {
    const req = context.switchToHttp().getRequest();
    const traceId = req?.id as string | undefined;

    return next.handle().pipe(
      map((value) => {
        const base = {
          success: true as const,
          traceId,
          timestamp: new Date().toISOString(),
        };
        if (hasPagination(value)) {
          return { ...base, data: value.data as T, pagination: value.pagination };
        }
        return { ...base, data: value as T };
      }),
    );
  }
}
