import type { PrismaService } from "../../prisma/prisma.service";
import { ContentStatus } from "../enums/content-status.enum";
import { resolveContentAuthor } from "./content-author";

export interface ContentMetaExisting {
  status?: string;
  systemPublishedAt?: Date | null;
}

export interface ContentMetaPatch {
  createdById?: string;
  createdBy?: string;
  lastOperatorId?: string;
  lastOperator?: string;
  systemPublishedAt?: Date;
}

/** 写入创建人（仅新建）与最后操作人；首次发布时记录真实系统发布时间（之后不再变更）。 */
export async function applyContentEditorMetadata(
  prisma: PrismaService,
  editorId: string | undefined,
  nextStatus: string | undefined,
  existing?: ContentMetaExisting | null,
): Promise<ContentMetaPatch> {
  const patch: ContentMetaPatch = {};

  if (editorId) {
    patch.lastOperatorId = editorId;
    patch.lastOperator = await resolveContentAuthor(prisma, editorId);
    if (existing == null) {
      patch.createdById = editorId;
      patch.createdBy = patch.lastOperator;
    }
  }

  const publishing =
    nextStatus === ContentStatus.PUBLISHED &&
    (existing == null || existing.status !== ContentStatus.PUBLISHED);

  if (publishing && !existing?.systemPublishedAt) {
    patch.systemPublishedAt = new Date();
  }

  return patch;
}
