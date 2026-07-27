import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContactService } from '../contact/contact.service';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatRoomService } from '../support/chat-room.service';

/**
 * 回收站到期清理（询盘/客户/会话）：
 * 软删超过保留期（默认 30 天）的行由本任务每日物理清除。
 * 复用各模块 Service 的 purge（联动断链 + 审计快照同口径），不在此重写删除逻辑；
 * 审计 userId 记为 null 表示系统任务。凌晨 4 点执行，错开 3 点的聊天附件清理。
 */
@Injectable()
export class TrashCleanupService {
  private readonly logger = new Logger(TrashCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactService: ContactService,
    private readonly customersService: CustomersService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runDailyCleanup(): Promise<void> {
    const retentionDays = Number(process.env.TRASH_RETENTION_DAYS ?? 30);
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const contacts = await this.purgeExpiredContacts(cutoff);
    const customers = await this.purgeExpiredCustomers(cutoff);
    const chatRooms = await this.purgeExpiredChatRooms(cutoff);
    if (contacts + customers + chatRooms > 0) {
      this.logger.log(
        `回收站到期清理完成：询盘 ${contacts} 条，客户 ${customers} 条，会话 ${chatRooms} 条`,
      );
    }
  }

  /** 到期询盘：逐条走 ContactService.purge（含 Customer.contactId 置空 + 系统备注） */
  private async purgeExpiredContacts(cutoff: Date): Promise<number> {
    const rows = await this.prisma.contact.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    let done = 0;
    for (const row of rows) {
      try {
        await this.contactService.purge(row.id, null);
        done += 1;
      } catch (err) {
        // 单条失败不中断整批（下次任务重试），记录告警供排查
        this.logger.warn(`到期询盘清理失败 id=${row.id}: ${(err as Error).message}`);
      }
    }
    return done;
  }

  /** 到期客户：逐条走 CustomersService.purge（含 ChatRoom.customerId 置空） */
  private async purgeExpiredCustomers(cutoff: Date): Promise<number> {
    const rows = await this.prisma.customer.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    let done = 0;
    for (const row of rows) {
      try {
        await this.customersService.purge(row.id, null);
        done += 1;
      } catch (err) {
        this.logger.warn(`到期客户清理失败 id=${row.id}: ${(err as Error).message}`);
      }
    }
    return done;
  }

  /** 到期会话：逐条走 ChatRoomService.purgeChatRoom（含 S3 附件删除 + Customer.chatRoomId 置空） */
  private async purgeExpiredChatRooms(cutoff: Date): Promise<number> {
    const rows = await this.prisma.chatRoom.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { roomId: true },
    });
    let done = 0;
    for (const row of rows) {
      try {
        await this.chatRoomService.purgeChatRoom(row.roomId, null);
        done += 1;
      } catch (err) {
        this.logger.warn(`到期会话清理失败 roomId=${row.roomId}: ${(err as Error).message}`);
      }
    }
    return done;
  }
}
