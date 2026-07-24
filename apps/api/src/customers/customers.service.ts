import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { resolveContentAuthor } from '../common/utils/content-author';
import { LAST_OPERATOR_USER_SELECT } from '../common/utils/content-list';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateCustomerDto, TransferCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

/** 关联用户展示字段（owner / lastOperator / createdBy 复用同一结构） */
const CUSTOMER_USER_SELECT = LAST_OPERATOR_USER_SELECT;

const CUSTOMER_INCLUDE = {
  owner: { select: CUSTOMER_USER_SELECT },
  lastOperatorUser: { select: CUSTOMER_USER_SELECT },
  createdByUser: { select: CUSTOMER_USER_SELECT },
} as const;

const CUSTOMER_AGENT_SELECT = {
  id: true,
  username: true,
  nickname: true,
} as const;

type Scope = 'mine' | 'public' | 'all';

/** 转线索去重键：优先会话（chatRoomId），其次询盘（contactId），均无则不去重。 */
function dedupeWhere(dto: CreateCustomerDto): Prisma.CustomerWhereUniqueInput | null {
  if (dto.chatRoomId) return { chatRoomId: dto.chatRoomId };
  if (dto.contactId) return { contactId: dto.contactId };
  return null;
}

/** 幂等去重：命中已有客户则返回完整实体（含关联 User），否则 null。 */
async function findDuplicateCustomer(tx: Prisma.TransactionClient, dto: CreateCustomerDto) {
  const where = dedupeWhere(dto);
  if (!where) return null;
  const existing = await tx.customer.findUnique({ where });
  if (!existing) return null;
  return tx.customer.findUnique({ where: { id: existing.id }, include: CUSTOMER_INCLUDE });
}

interface FindAllParams {
  page: number;
  limit: number;
  search?: string;
  scope: Scope;
  canViewAll: boolean;
  currentUserId: string;
  stage?: string;
  level?: string;
  source?: string;
  customerType?: string;
  sortBy?: string;
  sortOrder?: string;
}

const SORTABLE: Record<
  string,
  { field: keyof Prisma.CustomerOrderByWithRelationInput; dir: 'asc' | 'desc' }
> = {
  name: { field: 'name', dir: 'asc' },
  company: { field: 'company', dir: 'asc' },
  amount: { field: 'amount', dir: 'desc' },
  lastContactAt: { field: 'lastContactAt', dir: 'desc' },
  nextFollowAt: { field: 'nextFollowAt', dir: 'asc' },
  createdAt: { field: 'createdAt', dir: 'desc' },
  updatedAt: { field: 'updatedAt', dir: 'desc' },
};

const DEFAULT_ORDER: Prisma.CustomerOrderByWithRelationInput = {
  updatedAt: 'desc',
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(
    scope: Scope,
    canViewAll: boolean,
    currentUserId: string,
  ): Prisma.CustomerWhereInput {
    // 非管理员（无 customers.manage）即便传 all 也只允许看自己的私海
    if (scope === 'public') return { ownerId: null };
    if (scope === 'all' && canViewAll) return {};
    // 默认 / mine：仅自己的私海
    return { ownerId: currentUserId };
  }

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      search,
      scope,
      canViewAll,
      currentUserId,
      stage,
      level,
      source,
      customerType,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = this.scopeWhere(scope, canViewAll, currentUserId);
    if (stage) where.stage = stage;
    if (level) where.level = level;
    if (source) where.source = source;
    if (customerType) where.customerType = customerType;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { company: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderInput: Prisma.CustomerOrderByWithRelationInput =
      sortBy && SORTABLE[sortBy]
        ? ({
            [SORTABLE[sortBy].field]: dir,
            updatedAt: 'desc',
          } as Prisma.CustomerOrderByWithRelationInput)
        : DEFAULT_ORDER;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderInput,
        include: CUSTOMER_INCLUDE,
      }),
      this.prisma.customer.count({ where }),
    ]);

    // 反查来源对应的匿名访客 ID，供前端跳转访客详情抽屉（无 Prisma 关系，故当前页批量二次查询后内存映射）：
    //  - 会话链路：Customer.chatRoomId = ChatRoom.roomId → ChatRoom.visitorId
    //  - 询盘链路：Customer.contactId = Contact.id → Contact.visitorId（询盘转线索）
    const roomIds = data.map((c) => c.chatRoomId).filter((id): id is string => Boolean(id));
    const contactIds = data.map((c) => c.contactId).filter((id): id is string => Boolean(id));
    const [rooms, contacts] = await Promise.all([
      roomIds.length
        ? this.prisma.chatRoom.findMany({
            where: { roomId: { in: roomIds }, visitorId: { not: null } },
            select: { roomId: true, visitorId: true },
          })
        : Promise.resolve([]),
      contactIds.length
        ? this.prisma.contact.findMany({
            where: { id: { in: contactIds }, visitorId: { not: null } },
            select: { id: true, visitorId: true },
          })
        : Promise.resolve([]),
    ]);
    const visitorByRoom = new Map(rooms.map((r) => [r.roomId, r.visitorId]));
    const visitorByContact = new Map(contacts.map((c) => [c.id, c.visitorId]));
    const enriched = data.map((c) => ({
      ...c,
      // 会话链路优先（实时度高），其次回退询盘链路
      visitorId:
        (c.chatRoomId ? visitorByRoom.get(c.chatRoomId) : null) ??
        (c.contactId ? visitorByContact.get(c.contactId) : null) ??
        null,
    }));

    return {
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.customer.findUnique({
      where: { id },
      include: CUSTOMER_INCLUDE,
    });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    return item;
  }

  async listAgents() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: CUSTOMER_AGENT_SELECT,
      orderBy: { username: 'asc' },
    });
  }

  /** 私海 / 公海 / 总量计数（用于菜单徽标与概览） */
  async summary(currentUserId: string, canViewAll: boolean) {
    const [mine, publicCount, total] = await Promise.all([
      this.prisma.customer.count({ where: { ownerId: currentUserId } }),
      this.prisma.customer.count({ where: { ownerId: null } }),
      canViewAll
        ? this.prisma.customer.count()
        : this.prisma.customer.count({ where: { ownerId: currentUserId } }),
    ]);
    return { mine, public: publicCount, total: canViewAll ? total : mine };
  }

  async create(dto: CreateCustomerDto, operatorId: string) {
    const author = await resolveContentAuthor(this.prisma, operatorId);
    // ownerId 区分「不传」与「显式 null」：
    // - undefined → operatorId（私海）
    // - null     → null（公海）
    // - string   → 指定坐席私海
    const ownerId = dto.ownerId === undefined ? operatorId : dto.ownerId;

    return this.prisma.$transaction(async (tx) => {
      // 会话 / 询盘转线索：幂等去重，命中已有客户则直接返回（避免重复生成）
      const deduped = await findDuplicateCustomer(tx, dto);
      if (deduped) return deduped;

      const data: Prisma.CustomerUncheckedCreateInput = {
        name: dto.name,
        company: dto.company,
        title: dto.title,
        phone: dto.phone,
        email: dto.email,
        customerType: dto.customerType ?? 'other',
        source: dto.source,
        level: dto.level ?? 'C',
        stage: dto.stage ?? 'new',
        amount: dto.amount,
        region: dto.region,
        address: dto.address,
        tags: dto.tags ?? [],
        notes: dto.notes,
        ownerId,
        lastContactAt: dto.lastContactAt ? new Date(dto.lastContactAt) : null,
        nextFollowAt: dto.nextFollowAt ? new Date(dto.nextFollowAt) : null,
        lastOperatorId: operatorId,
        lastOperator: author,
        createdById: operatorId,
        createdBy: author,
        chatRoomId: dto.chatRoomId ?? null,
        contactId: dto.contactId ?? null,
      };
      const customer = await tx.customer.create({ data, include: CUSTOMER_INCLUDE });

      // 反向关联：在聊天室记录已转化客户，便于会话页展示「查看客户」
      if (dto.chatRoomId) {
        await tx.chatRoom
          .update({
            where: { roomId: dto.chatRoomId },
            data: { customerId: customer.id },
          })
          .catch(() => {});
      }
      return customer;
    });
  }

  async update(id: string, dto: UpdateCustomerDto, operatorId: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);

    const data: Prisma.CustomerUncheckedUpdateInput = { ...dto };
    if (dto.lastContactAt !== undefined) {
      data.lastContactAt = dto.lastContactAt ? new Date(dto.lastContactAt) : null;
    }
    if (dto.nextFollowAt !== undefined) {
      data.nextFollowAt = dto.nextFollowAt ? new Date(dto.nextFollowAt) : null;
    }
    data.lastOperatorId = operatorId;
    data.lastOperator = await resolveContentAuthor(this.prisma, operatorId);

    return this.prisma.customer.update({
      where: { id },
      data,
      include: CUSTOMER_INCLUDE,
    });
  }

  async remove(id: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true };
  }

  /** 认领：仅可从公海（ownerId 为空）认领到本人私海 */
  async claim(id: string, operatorId: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (item.ownerId && item.ownerId !== operatorId) {
      throw new ConflictException('该客户已被其他坐席认领，如需接收请使用「转移」');
    }
    if (item.ownerId === operatorId) return item; // 幂等
    return this.prisma.customer.update({
      where: { id },
      data: {
        ownerId: operatorId,
        lastOperatorId: operatorId,
        lastOperator: await resolveContentAuthor(this.prisma, operatorId),
      },
      include: CUSTOMER_INCLUDE,
    });
  }

  /** 退回公海：仅本人或管理员可操作 */
  async release(id: string, operatorId: string, isAdmin: boolean) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (!isAdmin && item.ownerId !== operatorId) {
      throw new ForbiddenException('只能退回自己私海中的客户');
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        ownerId: null,
        lastOperatorId: operatorId,
        lastOperator: await resolveContentAuthor(this.prisma, operatorId),
      },
      include: CUSTOMER_INCLUDE,
    });
  }

  /** 转移：把本人/任意私海客户转移给其他坐席（管理员可跨私海） */
  async transfer(id: string, dto: TransferCustomerDto, operatorId: string, isAdmin: boolean) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (!isAdmin && item.ownerId !== operatorId) {
      throw new ForbiddenException('只能转移自己私海中的客户');
    }
    if (dto.toUserId === operatorId) return item; // 转给自己，幂等
    const target = await this.prisma.user.findUnique({
      where: { id: dto.toUserId },
      select: { id: true, isActive: true },
    });
    if (!target) throw new BadRequestException('接收方坐席不存在');
    if (!target.isActive) throw new BadRequestException('接收方坐席已停用');
    return this.prisma.customer.update({
      where: { id },
      data: {
        ownerId: dto.toUserId,
        lastOperatorId: operatorId,
        lastOperator: await resolveContentAuthor(this.prisma, operatorId),
      },
      include: CUSTOMER_INCLUDE,
    });
  }
}
