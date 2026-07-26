import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SettingsModule } from '../settings/settings.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}), // 签名参数在 service 内按令牌类型指定
    SettingsModule, // AuthService.me() 计算 twoFactorSetupRequired 需读安全策略开关
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, TwoFactorService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
