import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { CasesModule } from "./cases/cases.module";
import { NewsModule } from "./news/news.module";
import { BlogsModule } from "./blogs/blogs.module";
import { TradeShowsModule } from "./trade-shows/trade-shows.module";
import { PagesModule } from "./pages/pages.module";
import { ContactModule } from "./contact/contact.module";
import { StorageModule } from "./storage/storage.module";
import { MediaModule } from "./media/media.module";
import { PublishingModule } from "./publishing/publishing.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AccessModule } from "./access/access.module";
import { AuditModule } from "./audit/audit.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SecurityModule } from "./security/security.module";
import { SettingsModule } from "./settings/settings.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { NotificationModule } from "./notifications/notification.module";
import { SystemModule } from "./system/system.module";
import { DocumentsModule } from "./documents/documents.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env", "../../.env"],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>("THROTTLE_TTL") ?? 60) * 1000,
            limit: config.get<number>("THROTTLE_LIMIT") ?? 120,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    CasesModule,
    NewsModule,
    BlogsModule,
    TradeShowsModule,
    PagesModule,
    ContactModule,
    StorageModule,
    MediaModule,
    PublishingModule,
    UsersModule,
    AccessModule,
    AuditModule,
    AnalyticsModule,
    SecurityModule,
    SettingsModule,
    IntegrationsModule,
    NotificationModule,
    SystemModule,
    DocumentsModule,
  ],
  providers: [
    // 全局限流
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // 全局鉴权（@Public 放行）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局角色控制（@Roles 生效）
    { provide: APP_GUARD, useClass: RolesGuard },
    // 统一响应包装（最外层）
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // 写操作审计（内层，读取控制器原始返回值）
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // 统一异常处理
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
