import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { createClient, type RedisClientType } from 'redis';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { ChatGateway } from './chat.gateway';
import { ChatAttachmentCleanupService } from './chat-attachment-cleanup.service';
import { ChatAuthService } from './chat-auth.service';
import { ChatNotificationService } from './chat-notification.service';
import { ChatPresenceStore } from './chat-presence.store';
import { ChatRoomController } from './chat-room.controller';
import { ChatRoomService } from './chat-room.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Redis 客户端集合：未配置 REDIS_URL 时返回 null（单实例内存模式）。 */
export const CHAT_REDIS = 'CHAT_REDIS';
export interface ChatRedisClients {
  pub: RedisClientType;
  sub: RedisClientType;
  presence: RedisClientType;
}

@Module({
  imports: [StorageModule, SettingsModule, IntegrationsModule, JwtModule.register({})],
  controllers: [SupportController, ChatRoomController],
  providers: [
    SupportService,
    ChatRoomService,
    ChatAttachmentCleanupService,
    ChatGateway,
    ChatAuthService,
    ChatNotificationService,
    {
      provide: CHAT_REDIS,
      useFactory: (): ChatRedisClients | null => {
        const url = process.env.REDIS_URL;
        if (!url) return null;
        const pub = createClient({ url });
        const sub = createClient({ url });
        const presence = createClient({ url });
        void pub.connect();
        void sub.connect();
        void presence.connect();
        return { pub, sub, presence } as unknown as ChatRedisClients;
      },
    },
    {
      provide: ChatPresenceStore,
      useFactory: (redis: ChatRedisClients | null) =>
        new ChatPresenceStore(redis?.presence ?? null),
      inject: [CHAT_REDIS],
    },
  ],
  exports: [SupportService, ChatRoomService, ChatGateway, ChatAuthService],
})
export class SupportModule {}
