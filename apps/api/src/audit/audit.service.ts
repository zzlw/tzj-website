import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { ListSortParams, parseListSort } from '../common/utils/list-sort';
import { PrismaService } from '../prisma/prisma.service';

export interface FindAuditLogsParams {
  page: number;
  limit: number;
  userId?: string;
  resource?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

const AUDIT_SORT_FIELDS = ['createdAt', 'user', 'action', 'resource', 'resourceId', 'ip'] as const;

const DEFAULT_AUDIT_ORDER: Prisma.AuditLogOrderByWithRelationInput[] = [{ createdAt: 'desc' }];

const USER_SELECT = {
  id: true,
  username: true,
  nickname: true,
} as const;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAuditLogsParams) {
    const { page, limit, userId, resource, action, from, to, search, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;
    const where = this.buildWhere({ userId, resource, action, from, to, search });
    const sort = parseListSort(sortBy, sortOrder, AUDIT_SORT_FIELDS);
    const orderBy = buildAuditOrderBy(sort);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { user: { select: USER_SELECT } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT } },
    });
    if (!row) throw new NotFoundException(`审计记录 "${id}" 未找到`);
    return row;
  }

  private buildWhere(filters: Omit<FindAuditLogsParams, 'page' | 'limit'>) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.action) where.action = filters.action;

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const q = filters.search?.trim();
    if (q) {
      where.OR = [
        { resourceId: { contains: q, mode: 'insensitive' } },
        { ip: { contains: q } },
        { traceId: { contains: q, mode: 'insensitive' } },
        { user: { username: { contains: q, mode: 'insensitive' } } },
        { user: { nickname: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}

function buildAuditOrderBy(sort: ListSortParams): Prisma.AuditLogOrderByWithRelationInput[] {
  if (!sort.sortBy || !sort.sortOrder) return DEFAULT_AUDIT_ORDER;

  const order = sort.sortOrder;
  if (sort.sortBy === 'user') {
    return [{ user: { username: order } }, { createdAt: 'desc' }];
  }

  return [{ [sort.sortBy]: order }, { createdAt: 'desc' }];
}
