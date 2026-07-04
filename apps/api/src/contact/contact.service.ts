import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client/index";
import { CreateContactDto, UpdateContactDto } from "./dto/contact.dto";
import { resolveContentAuthor } from "../common/utils/content-author";
import { LAST_OPERATOR_USER_SELECT } from "../common/utils/content-list";

interface FindAllParams {
  page: number;
  limit: number;
  isRead?: boolean;
  isHandled?: boolean;
}

const CONTACT_OPERATOR_INCLUDE = {
  lastOperatorUser: { select: LAST_OPERATOR_USER_SELECT },
} as const;

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const { page, limit, isRead, isHandled } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {};
    if (isRead !== undefined) where.isRead = isRead;
    if (isHandled !== undefined) where.isHandled = isHandled;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: CONTACT_OPERATOR_INCLUDE,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.contact.findUnique({
      where: { id },
      include: CONTACT_OPERATOR_INCLUDE,
    });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);
    return item;
  }

  async create(dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: { ...dto, source: dto.source ?? "website" },
    });
  }

  async update(id: string, dto: UpdateContactDto, operatorId?: string) {
    const item = await this.prisma.contact.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);

    const data: Prisma.ContactUncheckedUpdateInput = { ...dto };
    if (operatorId) {
      data.lastOperatorId = operatorId;
      data.lastOperator = await resolveContentAuthor(this.prisma, operatorId);
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      include: CONTACT_OPERATOR_INCLUDE,
    });
  }

  async remove(id: string) {
    const item = await this.prisma.contact.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);
    await this.prisma.contact.delete({ where: { id } });
    return { deleted: true };
  }
}
