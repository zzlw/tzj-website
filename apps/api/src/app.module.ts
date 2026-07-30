import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TwoFactorEnforcementGuard } from './auth/guards/two-factor-enforcement.guard';
import { BlogsModule } from './blogs/blogs.module';
import { CasesModule } from './cases/cases.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ClientIpThrottlerGuard } from './common/guards/client-ip-throttler.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { validateEnv } from './config/env.validation';
import { ContactModule } from './contact/contact.module';
import { CustomersModule } from './customers/customers.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LingxiModule } from './lingxi/lingxi.module';
import { MediaModule } from './media/media.module';
import { NewsModule } from './news/news.module';
import { NotificationModule } from './notifications/notification.module';
import { PagesModule } from './pages/pages.module';
import { PreviewModule } from './preview/preview.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublishingModule } from './publishing/publishing.module';
import { IpBanGuard } from './security/ip-ban.guard';
import { SecurityModule } from './security/security.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { SupportModule } from './support/support.module';
import { SystemModule } from './system/system.module';
import { TradeShowsModule } from './trade-shows/trade-shows.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLE_TTL') ?? 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 120,
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
    PreviewModule,
    ContactModule,
    CustomersModule,
    CleanupModule,
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
    LingxiModule,
    NotificationModule,
    SystemModule,
    DocumentsModule,
    SupportModule,
  ],
  providers: [
    // 全局限流（tracker 统一为真实客户端 IP，见 ClientIpThrottlerGuard）
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    // 全局鉴权（@Public 放行）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局 IP 封禁（置于鉴权之后：豁免已认证管理员，仅拦截命中封禁名单的访客）
    { provide: APP_GUARD, useClass: IpBanGuard },
    // 全局角色控制（@Roles 生效）
    { provide: APP_GUARD, useClass: RolesGuard },
    // 强制 2FA（开关打开时拦截未绑定用户，@AllowUnenrolled 豁免；依赖 req.user，须在鉴权之后）
    { provide: APP_GUARD, useClass: TwoFactorEnforcementGuard },
    // 统一响应包装（最外层）
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // 写操作审计（内层，读取控制器原始返回值）
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // 统一异常处理
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
