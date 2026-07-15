import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TicketResult {
  id: string;
  ticketId: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  isAnonymous: boolean;
  anonymousEmail?: string | null;
  anonymousName?: string | null;
  assignedTo?: string | null;
  comments?: CommentResult[];
  lastUpdated: Date | string;
  resolvedAt?: Date | string | null;
  isInternal: boolean;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CommentResult {
  id: string;
  message: string;
  author: string;
  isInternal: boolean;
  isAnonymous: boolean;
  userRole?: string | null;
  isSystemMessage: boolean;
  attachments: string[];
  editedAt?: Date | string | null;
  editedBy?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  ticketId: string;
}

const COMMENT_SELECT = {
  id: true,
  message: true,
  author: true,
  isInternal: true,
  isAnonymous: true,
  userRole: true,
  isSystemMessage: true,
  attachments: true,
  editedAt: true,
  editedBy: true,
  createdAt: true,
  updatedAt: true,
  ticketId: true,
} as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private generateTicketId(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `TK${timestamp}${random}`;
  }

  /* ==================== 创建工单 ==================== */

  async createTicket(dto: {
    subject: string;
    message: string;
    category?: string;
    priority?: string;
    isAnonymous?: boolean;
    anonymousEmail?: string;
    anonymousName?: string;
  }): Promise<TicketResult> {
    const ticketId = this.generateTicketId();

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketId,
        subject: dto.subject,
        message: dto.message,
        category: dto.category ?? 'general-inquiry',
        priority: dto.priority ?? 'medium',
        status: 'open',
        isAnonymous: true,
        anonymousEmail: dto.anonymousEmail,
        anonymousName: dto.anonymousName,
        lastUpdated: new Date(),
        comments: {
          create: {
            message: dto.message,
            author: dto.anonymousName || dto.anonymousEmail || 'Anonymous',
          },
        },
      },
      include: { comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' } } },
    });

    return ticket as unknown as TicketResult;
  }

  /* ==================== 查询单个 ==================== */

  async getTicketById(ticketId: string): Promise<TicketResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketId },
      include: { comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }
    return ticket as unknown as TicketResult;
  }

  /* ==================== 评论 ==================== */

  async addComment(
    ticketId: string,
    dto: { message: string; isInternal?: boolean; author?: string },
  ): Promise<CommentResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        message: dto.message,
        author: dto.author || 'Anonymous',
        isInternal: dto.isInternal ?? false,
        ticketId: ticket.id,
      },
    });

    await this.prisma.ticket.update({
      where: { ticketId },
      data: { lastUpdated: new Date() },
    });

    return comment as unknown as CommentResult;
  }

  async getTicketComments(ticketId: string): Promise<CommentResult[]> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketId },
      include: { comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }
    return ticket.comments as unknown as CommentResult[];
  }

  /* ==================== 列表查询 ==================== */

  async getAllTickets(
    page = 1,
    limit = 10,
    status?: string,
    priority?: string,
    category?: string,
  ): Promise<{ tickets: TicketResult[]; total: number }> {
    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { tickets: tickets as unknown as TicketResult[], total };
  }

  /* ==================== 更新 ==================== */

  async updateTicket(
    ticketId: string,
    dto: {
      subject?: string;
      category?: string;
      priority?: string;
      status?: string;
      assignedTo?: string;
    },
  ): Promise<TicketResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    const data: any = { lastUpdated: new Date() };
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    await this.prisma.ticket.update({ where: { ticketId }, data });
    return this.getTicketById(ticketId);
  }

  /* ==================== 删除 ==================== */

  async deleteTicket(ticketId: string): Promise<void> {
    try {
      await this.prisma.ticket.delete({ where: { ticketId } });
    } catch {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }
  }

  /* ==================== 统计 ==================== */

  async getAdminStats(): Promise<{
    totalTickets: number;
    statusBreakdown: {
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
    };
    priorityBreakdown: { high: number; medium: number; low: number };
  }> {
    const [totalTickets, open, inProgress, resolved, closed, high, medium, low] = await Promise.all(
      [
        this.prisma.ticket.count(),
        this.prisma.ticket.count({ where: { status: 'open' } }),
        this.prisma.ticket.count({ where: { status: 'in_progress' } }),
        this.prisma.ticket.count({ where: { status: 'resolved' } }),
        this.prisma.ticket.count({ where: { status: 'closed' } }),
        this.prisma.ticket.count({ where: { priority: 'high' } }),
        this.prisma.ticket.count({ where: { priority: 'medium' } }),
        this.prisma.ticket.count({ where: { priority: 'low' } }),
      ],
    );

    return {
      totalTickets,
      statusBreakdown: { open, inProgress, resolved, closed },
      priorityBreakdown: { high, medium, low },
    };
  }
}
