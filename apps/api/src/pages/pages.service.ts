import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { sanitizeRichText } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.page.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`页面 "${slug}" 未找到`);
    return page;
  }

  async create(dto: CreatePageDto) {
    const { content, ...rest } = dto;
    return this.prisma.page.create({
      data: { ...rest, content: sanitizeRichText(content) },
    });
  }

  async update(id: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`页面 ID "${id}" 未找到`);
    const { content, ...rest } = dto;
    const data: Prisma.PageUpdateInput = { ...rest };
    if (content !== undefined) data.content = sanitizeRichText(content);
    return this.prisma.page.update({ where: { id }, data });
  }

  async remove(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`页面 ID "${id}" 未找到`);
    await this.prisma.page.delete({ where: { id } });
    return { deleted: true };
  }
}
