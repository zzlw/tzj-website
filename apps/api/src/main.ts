import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestId } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 仅信任回环/内网代理（BFF/反代）的 X-Forwarded-For，不可 true（公网可伪造）；
  // 与 common/utils/client-ip.ts 的 isTrustedProxyIp 口径一致
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // 安全 & 性能
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // CORS 白名单（逗号分隔）+ 生产域名模式匹配
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const prodPattern = /^https:\/\/(?:[\w-]+\.)?tzjii\.com$/;
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origins.includes(origin) || prodPattern.test(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  });

  // 全局验证管道（调试模式：暂时关闭 forbidNonWhitelisted）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // TODO: 开启前先修复 MoveDocumentDto 装饰器问题
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger API 文档
  const config = new DocumentBuilder()
    .setTitle('TZJ API')
    .setDescription('拓之迹应急救援训练装备 — API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '认证鉴权')
    .addTag('health', '健康检查')
    .addTag('cases', '工程案例')
    .addTag('news', '新闻资讯')
    .addTag('blogs', '博客')
    .addTag('trade-shows', '展会活动')
    .addTag('pages', '静态页面')
    .addTag('contact', '联系我们')
    .addTag('storage', '文件存储 (MinIO/OSS)')
    .addTag('media', '媒体库')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || process.env.PORT || 4000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 TZJ API running on http://localhost:${port}`);
  logger.log(`📄 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
