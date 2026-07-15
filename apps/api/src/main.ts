import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestId } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 安全 & 性能
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // CORS 白名单（逗号分隔）
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
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
