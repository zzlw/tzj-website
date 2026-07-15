import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ChatGateway } from './chat.gateway';
import { ChatAttachmentCleanupService } from './chat-attachment-cleanup.service';
import { ChatRoomController } from './chat-room.controller';
import { ChatRoomService } from './chat-room.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [StorageModule],
  controllers: [SupportController, ChatRoomController],
  providers: [SupportService, ChatRoomService, ChatAttachmentCleanupService, ChatGateway],
  exports: [SupportService, ChatRoomService, ChatGateway],
})
export class SupportModule {}
