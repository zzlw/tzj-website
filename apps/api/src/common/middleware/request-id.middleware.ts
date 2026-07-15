import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * 为每个请求附加 traceId（复用上游 x-request-id，否则生成）。
 * 挂在 req.id，并回写响应头，贯穿日志/响应/错误。
 */
export function requestId(req: Request & { id?: string }, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
