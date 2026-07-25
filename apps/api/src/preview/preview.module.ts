import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PreviewController } from './preview.controller';
import { PreviewTokenService } from './preview-token.service';

/** 草稿预览令牌：全局导出，供各内容模块的详情接口校验（无需逐一 import）。 */
@Global()
@Module({
  imports: [JwtModule.register({})], // 签名参数在 service 内指定（与 AuthModule 同风格）
  controllers: [PreviewController],
  providers: [PreviewTokenService],
  exports: [PreviewTokenService],
})
export class PreviewModule {}
