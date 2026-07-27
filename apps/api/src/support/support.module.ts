import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IpLocationService } from '../analytics/ip-location.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SecurityModule } from '../security/security.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { ChatGateway } from './chat.gateway';
import { ChatAttachmentCleanupService } from './chat-attachment-cleanup.service';
import { ChatAuthService } from './chat-auth.service';
import { ChatNotificationService } from './chat-notification.service';
import { ChatPresenceStore } from './chat-presence.store';
import { ChatRoomController } from './chat-room.controller';
import { ChatRoomService } from './chat-room.service';
import { MessageSearchService, PgTrgmMessageSearchService } from './message-search.service';

@Module({
  imports: [
    StorageModule,
    SettingsModule,
    IntegrationsModule,
    SecurityModule,
    JwtModule.register({}),
  ],
  controllers: [ChatRoomController],
  providers: [
    ChatRoomService,
    // 复用「访客分析」的 IP 归属地解析服务（纯真库 + 在线补充），
    // 供访客档案在读取时按原始 IP 重解析到省市区 + 运营商。无构造依赖，直接在本模块提供。
    IpLocationService,
    ChatAttachmentCleanupService,
    ChatGateway,
    ChatAuthService,
    ChatNotificationService,
    ChatPresenceStore,
    // 消息全文检索（阶段一：pg_trgm）。阶段二升级时仅需将 useClass 换为 MeiliMessageSearchService。
    { provide: MessageSearchService, useClass: PgTrgmMessageSearchService },
  ],
  exports: [ChatRoomService, ChatGateway, ChatAuthService],
})
export class SupportModule {}
