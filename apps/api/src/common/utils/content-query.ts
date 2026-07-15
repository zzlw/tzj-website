import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '../enums/content-status.enum';

/** 未登录/公开请求仅返回已发布内容；后台带 JWT 时可看全部状态。 */
export function applyPublishedFilter(includeUnpublished: boolean): { status?: string } {
  return includeUnpublished ? {} : { status: ContentStatus.PUBLISHED };
}

export function assertPublishedOrStaff(status: string, includeUnpublished: boolean): void {
  if (!includeUnpublished && status !== ContentStatus.PUBLISHED) {
    throw new NotFoundException();
  }
}
