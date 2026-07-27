import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { aggregateLastIp, pickLatestIp } from '../analytics/utils/last-ip';
import { resolveContentAuthor } from '../common/utils/content-author';
import { LAST_OPERATOR_USER_SELECT } from '../common/utils/content-list';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateCustomerDto,
  ImportCustomersDto,
  TransferCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

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

/** 单行导入失败明细（行号从 1 起，对应用户 CSV 的数据行序）。 */
export interface ImportRowError {
  row: number;
  message: string;
}

/** 批量导入结果：成功 / 跳过（重复）/ 失败计数 + 失败明细，供前端反馈。 */
export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

/** 转线索去重键：优先会话（chatRoomId），其次询盘（contactId），均无则不去重。 */
function dedupeWhere(dto: CreateCustomerDto): Prisma.CustomerWhereUniqueInput | null {
  if (dto.chatRoomId) return { chatRoomId: dto.chatRoomId };
  if (dto.contactId) return { contactId: dto.contactId };
  return null;
}

/** 幂等去重：命中已有客户则返回完整实体（含关联 User），否则 null。
 *  顺序：先按唯一键（会话 chatRoomId / 询盘 contactId）；未命中时再用 visitorId 兼底。
 *  Customer.visitorId 非唯一，故用 findFirst 做守卫（不能靠 DB 唯一约束），防止同一纯访客重复转化。 */
async function findDuplicateCustomer(tx: Prisma.TransactionClient, dto: CreateCustomerDto) {
  const where = dedupeWhere(dto);
  let existing = where ? await tx.customer.findUnique({ where }) : null;
  if (!existing && dto.visitorId) {
    // 软删客户不参与兼底去重（其唯一锚点已置空，允许同访客重新转化）
    existing = await tx.customer.findFirst({
      where: { visitorId: dto.visitorId, deletedAt: null },
    });
  }
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
  channel?: string;
  sortBy?: string;
  sortOrder?: string;
  /** true = 查看回收站（已软删），默认仅未删除 */
  deleted?: boolean;
}

/** 来源渠道筛选白名单（与访客中心/询盘 trafficSource 口径一致；区别于业务维度的 Customer.source）。 */
const CHANNEL_VALUES = new Set([
  'direct',
  'organic',
  'paid',
  'social',
  'email',
  'referral',
  'other',
]);

const SORTABLE: Record<
  string,
  { field: keyof Prisma.CustomerOrderByWithRelationInput; dir: 'asc' | 'desc' }
> = {
  name: { field: 'name', dir: 'asc' },
  company: { field: 'company', dir: 'asc' },
  // 枚举类列（类型/来源/等级/阶段）按字段码排序，主要用于聚拢同类（同内容模块 caseType/status 约定）
  customerType: { field: 'customerType', dir: 'asc' },
  source: { field: 'source', dir: 'asc' },
  level: { field: 'level', dir: 'asc' },
  stage: { field: 'stage', dir: 'asc' },
  region: { field: 'region', dir: 'asc' },
  amount: { field: 'amount', dir: 'desc' },
  lastContactAt: { field: 'lastContactAt', dir: 'desc' },
  nextFollowAt: { field: 'nextFollowAt', dir: 'asc' },
  createdAt: { field: 'createdAt', dir: 'desc' },
  updatedAt: { field: 'updatedAt', dir: 'desc' },
  // 创建人列（sortKey=createdById）：按 ID 聚拢同一创建人，与内容模块白名单口径一致
  createdById: { field: 'createdById', dir: 'asc' },
};

const DEFAULT_ORDER: Prisma.CustomerOrderByWithRelationInput = {
  updatedAt: 'desc',
};

/** 列表行（含 owner 等关联展示字段），富化方法与排序路径共用。 */
type CustomerListRow = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_INCLUDE }>;

/** 排序白名单 → Prisma orderBy 数组；「联系方式」列 = 电话优先、邮箱次之（与列展示主/副行一致），空值恒置后。 */
function buildOrderInput(
  sortBy: string | undefined,
  dir: 'asc' | 'desc',
): Prisma.CustomerOrderByWithRelationInput[] {
  if (sortBy === 'contact') {
    return [
      { phone: { sort: dir, nulls: 'last' } },
      { email: { sort: dir, nulls: 'last' } },
      { updatedAt: 'desc' },
    ];
  }
  // 归属列：按关联坐席用户名排序（展示为昵称/用户名），公海（owner 为空）由 DB 默认规则置前/置后
  if (sortBy === 'owner') {
    return [{ owner: { username: dir } }, { updatedAt: 'desc' }];
  }
  if (sortBy && SORTABLE[sortBy]) {
    // Prisma 多字段排序必须传数组（单对象多 key 会在运行时报 Invalid orderBy）
    return [{ [SORTABLE[sortBy].field]: dir }, { updatedAt: 'desc' }];
  }
  return [DEFAULT_ORDER];
}

/** 空值恒置后的字符串比较（同值返 0 保持预排序）；numeric 用于 IP 按段数值序（79.x < 121.x）。 */
function compareNullable(
  a: string | null,
  b: string | null,
  sign: number,
  numeric: boolean,
): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, numeric ? 'en' : 'zh-CN', { numeric }) * sign;
}

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
      channel,
      sortBy,
      sortOrder,
      deleted,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = this.scopeWhere(scope, canViewAll, currentUserId);
    // 回收站与正常列表互斥（软删范式同媒体库，见 docs/design/deletion-strategy.md）
    where.deletedAt = deleted ? { not: null } : null;
    if (stage) where.stage = stage;
    if (level) where.level = level;
    if (source) where.source = source;
    if (customerType) where.customerType = customerType;
    if (search?.trim()) {
      // 列表访客ID展示为「#xxxxxxxx」，用户会连 # 一起复制来搜，统一剥掉展示前缀
      const q = search.trim().replace(/^#/, '');
      const or: Prisma.CustomerWhereInput[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
        { visitorId: { contains: q, mode: 'insensitive' } },
      ];
      // 存量客户自身 visitorId 列可能为空，访客ID 需经会话/询盘链路反查（无 Prisma 关系，二次查询取 ID 集合）
      const [roomHits, contactHits] = await Promise.all([
        this.prisma.chatRoom.findMany({
          where: { visitorId: { contains: q, mode: 'insensitive' } },
          select: { roomId: true },
          take: 500,
        }),
        this.prisma.contact.findMany({
          where: { visitorId: { contains: q, mode: 'insensitive' } },
          select: { id: true },
          take: 500,
        }),
      ]);
      if (roomHits.length) or.push({ chatRoomId: { in: roomHits.map((r) => r.roomId) } });
      if (contactHits.length) or.push({ contactId: { in: contactHits.map((c) => c.id) } });
      where.OR = or;
    }

    const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    // 来源渠道筛选与「最后访问 IP / 来源渠道」排序都依赖富化字段（page_views 反查聚合，
    // 且访客 ID 需经会话/询盘链路解析，无法用 where/orderBy 表达），
    // 走全量富化后内存筛选/排序再切页（客户量级小，同询盘表地区/渠道策略）。
    const channelFilter = channel && CHANNEL_VALUES.has(channel) ? channel : undefined;
    if (channelFilter || sortBy === 'lastIp' || sortBy === 'channel') {
      return this.findPageEnriched(where, { channelFilter, sortBy, dir, page, limit });
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildOrderInput(sortBy, dir),
        include: CUSTOMER_INCLUDE,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: await this.enrichRows(data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 列表行富化：补充来源访客 ID 与「最后访问 IP」（明文 + 脱敏 + ipHash 供抽屉下钻）。
   * 访客 ID 反查（无 Prisma 关系，批量二次查询后内存映射）：
   *  - 会话链路：Customer.chatRoomId = ChatRoom.roomId → ChatRoom.visitorId
   *  - 询盘链路：Customer.contactId = Contact.id → Contact.visitorId（询盘转线索）
   */
  private async enrichRows(data: CustomerListRow[]) {
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
    const withVisitor = data.map((c) => ({
      ...c,
      // 自身列优先（转化时直接锚定，最可靠），其次会话链路（实时度高），再回退询盘链路
      visitorId:
        c.visitorId ??
        (c.chatRoomId ? visitorByRoom.get(c.chatRoomId) : null) ??
        (c.contactId ? visitorByContact.get(c.contactId) : null) ??
        null,
    }));

    // 「最后访问 IP」富化：按解析出的 visitorId 或 userId=contactId（identify 回写）聚合
    // page_views 最近一次非空 IP，两条口径命中取最近访问的一条；脱敏 + ipHash 供抽屉下钻，原始 IP 不外泄。
    const ipVisitorIds = withVisitor.map((c) => c.visitorId).filter((v): v is string => Boolean(v));
    const ipContactIds = data.map((c) => c.contactId).filter((id): id is string => Boolean(id));
    const [ipByVisitor, ipByUser] = await Promise.all([
      aggregateLastIp(this.prisma, 'visitorId', ipVisitorIds),
      aggregateLastIp(this.prisma, 'userId', ipContactIds),
    ]);
    const ipVisitorMap = new Map(ipByVisitor.map((r) => [r.key, r]));
    const ipUserMap = new Map(ipByUser.map((r) => [r.key, r]));

    return withVisitor.map((c) => {
      const viaVisitor = c.visitorId ? ipVisitorMap.get(c.visitorId) : undefined;
      const viaUser = c.contactId ? ipUserMap.get(c.contactId) : undefined;
      const best = pickLatestIp(viaVisitor, viaUser);
      return {
        ...c,
        lastIp: best?.lastIp ?? null,
        lastIpMasked: best?.lastIpMasked ?? null,
        lastIpHash: best?.lastIpHash ?? null,
        // 首触来源渠道 + 引荐域名（流量归因维度，与询盘/访客中心口径一致；区别于业务维度的 source）
        channel: best?.channel ?? null,
        referrerHost: best?.referrerHost ?? null,
      };
    });
  }

  /**
   * 富化字段筛选/排序的分页：全量取行富化后内存处理再切页。
   * - 筛选：来源渠道按列表展示同源的首触归因口径匹配；
   * - 排序：lastIp / channel 为富化字段内存排序（空值恒置后）；其余 sortBy 由取数 orderBy 预排。
   */
  private async findPageEnriched(
    where: Prisma.CustomerWhereInput,
    opts: {
      channelFilter?: string;
      sortBy?: string;
      dir: 'asc' | 'desc';
      page: number;
      limit: number;
    },
  ) {
    const { channelFilter, sortBy, dir, page, limit } = opts;
    const rows = await this.prisma.customer.findMany({
      where,
      // lastIp/channel 不在白名单，buildOrderInput 回退默认序作为稳定预排；
      // 渠道筛选 + 库字段排序叠加时，则由这里保留 DB 排序语义
      orderBy: buildOrderInput(sortBy, dir),
      include: CUSTOMER_INCLUDE,
    });
    let enriched = await this.enrichRows(rows);
    if (channelFilter) enriched = enriched.filter((c) => c.channel === channelFilter);
    const sign = dir === 'asc' ? 1 : -1;
    if (sortBy === 'lastIp') {
      enriched.sort((a, b) => compareNullable(a.lastIp, b.lastIp, sign, true));
    } else if (sortBy === 'channel') {
      enriched.sort((a, b) => compareNullable(a.channel, b.channel, sign, false));
    }
    const total = enriched.length;
    const skip = (page - 1) * limit;
    return {
      data: enriched.slice(skip, skip + limit),
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
      this.prisma.customer.count({ where: { ownerId: currentUserId, deletedAt: null } }),
      this.prisma.customer.count({ where: { ownerId: null, deletedAt: null } }),
      canViewAll
        ? this.prisma.customer.count({ where: { deletedAt: null } })
        : this.prisma.customer.count({ where: { ownerId: currentUserId, deletedAt: null } }),
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
        visitorId: dto.visitorId ?? null,
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

  /**
   * 批量导入客户（CSV 解析后逐条写入）。
   * - 归属：scope=public → ownerId 置空（公海）；scope=mine → 当前坐席私海。
   * - 去重：按 email（非空、忽略大小写）与库内既有客户及本批次已写入行比对，命中则跳过，
   *   避免重复导入同一联系人（CSV 无 chatRoomId/contactId，故不走会话/询盘去重）。
   * - 逐条写入并捕获单行异常，返回成功/跳过/失败计数与失败明细（不因单行失败中断整批）。
   */
  async importMany(dto: ImportCustomersDto, operatorId: string): Promise<ImportResult> {
    const ownerId = dto.scope === 'public' ? null : operatorId;
    const author = await resolveContentAuthor(this.prisma, operatorId);

    // 预载库内已存在的邮箱（非空），用于跳过重复导入
    const emails = dto.items
      .map((i) => i.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));
    const existing = emails.length
      ? await this.prisma.customer.findMany({
          where: { email: { in: [...new Set(emails)] }, deletedAt: null },
          select: { email: true },
        })
      : [];
    const seen = new Set(
      existing.map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)),
    );

    let created = 0;
    let skipped = 0;
    const errors: ImportRowError[] = [];

    let rowNo = 0;
    for (const row of dto.items) {
      rowNo++;
      const name = row.name?.trim();
      if (!name) {
        errors.push({ row: rowNo, message: '缺少联系人姓名' });
        continue;
      }
      const emailKey = row.email?.trim().toLowerCase();
      if (emailKey && seen.has(emailKey)) {
        skipped++;
        continue;
      }
      try {
        const data: Prisma.CustomerUncheckedCreateInput = {
          name,
          company: row.company,
          title: row.title,
          phone: row.phone,
          email: row.email,
          customerType: row.customerType ?? 'other',
          source: row.source,
          level: row.level ?? 'C',
          stage: row.stage ?? 'new',
          amount: row.amount,
          region: row.region,
          address: row.address,
          tags: row.tags ?? [],
          notes: row.notes,
          ownerId,
          lastContactAt: row.lastContactAt ? new Date(row.lastContactAt) : null,
          nextFollowAt: row.nextFollowAt ? new Date(row.nextFollowAt) : null,
          lastOperatorId: operatorId,
          lastOperator: author,
          createdById: operatorId,
          createdBy: author,
        };
        await this.prisma.customer.create({ data });
        created++;
        if (emailKey) seen.add(emailKey);
      } catch (e) {
        errors.push({
          row: rowNo,
          message: e instanceof Error ? e.message : '写入失败',
        });
      }
    }

    return {
      total: dto.items.length,
      created,
      skipped,
      failed: errors.length,
      errors,
    };
  }

  async update(id: string, dto: UpdateCustomerDto, operatorId: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    this.assertNotTrashed(item);

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

  /** 回收站行禁止常规操作（编辑/认领/退回/转移），需先恢复。 */
  private assertNotTrashed(item: { deletedAt: Date | null }) {
    if (item.deletedAt) {
      throw new ConflictException({
        error: 'CUSTOMER_TRASHED',
        message: '该客户在回收站中，请先恢复后再操作',
      });
    }
  }

  /**
   * 软删除：移入回收站（30 天后由清理任务物理删除）。
   * 同步置空 chatRoomId/contactId 唯一锚点（受 @unique 约束，不置空会堵死同源重新转化），
   * 原值写入审计快照；恢复时不回填（见 docs/design/deletion-strategy.md §3.2）。
   * 权限：仅归属坐席本人或管理员可删（公海客户仅管理员）。
   */
  async remove(id: string, operatorId: string, isAdmin: boolean) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (item.deletedAt) {
      throw new ConflictException({
        error: 'CUSTOMER_ALREADY_TRASHED',
        message: '该客户已在回收站中',
      });
    }
    if (!isAdmin && item.ownerId !== operatorId) {
      throw new ForbiddenException('只能删除自己私海中的客户');
    }

    await this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        chatRoomId: null,
        contactId: null,
        lastOperatorId: operatorId,
        lastOperator: await resolveContentAuthor(this.prisma, operatorId),
      },
    });

    // 锚点原值入审计快照（全局拦截器只记请求级），供恢复后人工回溯来源
    if (item.chatRoomId || item.contactId) {
      await this.prisma.auditLog.create({
        data: {
          userId: operatorId,
          action: 'soft-delete',
          resource: 'customers',
          resourceId: id,
          detail: {
            unlinkedAnchors: {
              chatRoomId: item.chatRoomId,
              contactId: item.contactId,
              visitorId: item.visitorId,
            },
          },
        },
      });
    }
    return { deleted: true, soft: true };
  }

  /** 从回收站恢复（锚点不回填，来源可经审计日志回溯）。 */
  async restore(id: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (!item.deletedAt) {
      throw new ConflictException({
        error: 'CUSTOMER_NOT_TRASHED',
        message: '该客户不在回收站中',
      });
    }
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });
  }

  /**
   * 物理清除（仅 admin）：删除客户行；若仍有会话反向指向该客户（ChatRoom.customerId），
   * 先置空断链。审计快照由本方法显式落库。
   */
  async purge(id: string, operatorId: string | null) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    if (!item.deletedAt) {
      throw new ConflictException({
        error: 'CUSTOMER_NOT_TRASHED',
        message: '请先将客户移入回收站，再执行永久删除',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // 反向关联断链：会话页「查看客户」不再指向已清除的客户
      await tx.chatRoom.updateMany({
        where: { customerId: id },
        data: { customerId: null },
      });
      await tx.customer.delete({ where: { id } });
    });

    // 审计快照：仅记摘要字段，供合规追溯
    await this.prisma.auditLog.create({
      data: {
        userId: operatorId,
        action: 'purge',
        resource: 'customers',
        resourceId: id,
        detail: {
          snapshot: {
            name: item.name,
            company: item.company,
            phone: item.phone,
            email: item.email,
            stage: item.stage,
            level: item.level,
            ownerId: item.ownerId,
            visitorId: item.visitorId,
            createdAt: item.createdAt.toISOString(),
          },
        },
      },
    });
    return { deleted: true, purged: true };
  }

  /** 认领：仅可从公海（ownerId 为空）认领到本人私海 */
  async claim(id: string, operatorId: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`客户 ID "${id}" 未找到`);
    this.assertNotTrashed(item);
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
    this.assertNotTrashed(item);
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
    this.assertNotTrashed(item);
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
