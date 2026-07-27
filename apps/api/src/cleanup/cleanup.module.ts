import { Module } from '@nestjs/common';
import { ContactModule } from '../contact/contact.module';
import { CustomersModule } from '../customers/customers.module';
import { SupportModule } from '../support/support.module';
import { TrashCleanupService } from './trash-cleanup.service';

/** 回收站到期清理：合并询盘/客户/会话的软删过期物理清除为单一每日任务。 */
@Module({
  imports: [ContactModule, CustomersModule, SupportModule],
  providers: [TrashCleanupService],
})
export class CleanupModule {}
